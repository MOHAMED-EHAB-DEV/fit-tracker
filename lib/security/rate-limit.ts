import "server-only";
import mongoose, { Schema, type Model } from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import { tooManyRequests } from "@/lib/api/errors";

/**
 * Rate limiting backed by MongoDB, so limits hold across every serverless
 * instance and survive cold starts. One document per key per time window;
 * a TTL index removes expired windows.
 */
interface IRateLimitWindow {
  _id: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimitWindow>(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitWindow: Model<IRateLimitWindow> =
  (mongoose.models.RateLimitWindow as Model<IRateLimitWindow>) ||
  mongoose.model<IRateLimitWindow>("RateLimitWindow", RateLimitSchema);

export interface RateLimitRule {
  /** Short name of what is limited, e.g. "login" or "ai". */
  name: string;
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/** Counts one request against `rule` for `subject` (a user id, IP or email). */
export async function consumeRateLimit(rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${rule.name}:${subject}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs + 60_000);

  await getDb();

  let count = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await RateLimitWindow.findOneAndUpdate(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: "after" }
      ).lean();
      count = doc?.count ?? 1;
      break;
    } catch (err) {
      // Two first requests in the same window can race on the upsert.
      const duplicate = (err as { code?: number })?.code === 11000;
      if (!duplicate || attempt === 1) throw err;
    }
  }

  const allowed = count <= rule.limit;
  return {
    allowed,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
  };
}

/** Enforces a rate limit; throws a 429 HttpError when it is exceeded. */
export async function enforceRateLimit(rule: RateLimitRule, subject: string): Promise<void> {
  const result = await consumeRateLimit(rule, subject);
  if (!result.allowed) throw tooManyRequests(result.retryAfterSeconds);
}

/** Best-effort client IP behind the hosting platform's proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Shared limits. Tune here, not in individual routes. */
export const RATE_LIMITS = {
  loginPerIp: { name: "login-ip", limit: 20, windowSeconds: 15 * 60 },
  loginPerEmail: { name: "login-email", limit: 8, windowSeconds: 15 * 60 },
  signupPerIp: { name: "signup-ip", limit: 5, windowSeconds: 60 * 60 },
  passwordResetPerIp: { name: "pwreset-ip", limit: 5, windowSeconds: 60 * 60 },
  passwordResetPerEmail: { name: "pwreset-email", limit: 3, windowSeconds: 60 * 60 },
  aiPerMinute: { name: "ai-min", limit: 8, windowSeconds: 60 },
  aiPerDay: { name: "ai-day", limit: 120, windowSeconds: 24 * 60 * 60 },
  /** Requests to an AI route, counted before any work (the model calls have their own limits). */
  aiRoutePerMinute: { name: "ai-route-min", limit: 12, windowSeconds: 60 },
  uploadPerHour: { name: "upload-hr", limit: 60, windowSeconds: 60 * 60 },
  exportPerHour: { name: "export-hr", limit: 5, windowSeconds: 60 * 60 },
  writePerMinute: { name: "write-min", limit: 120, windowSeconds: 60 },
  imageProxyPerMinute: { name: "img-min", limit: 240, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;
