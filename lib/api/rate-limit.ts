import { NextRequest } from "next/server";

export interface RateLimitOptions {
  enabled?: boolean;
  limit?: number; // Max requests per window (default: 60)
  windowMs?: number; // Window size in milliseconds (default: 60,000ms = 1 min)
  keyGenerator?: (req: NextRequest) => string | Promise<string>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds until window reset
}

interface RateLimitBucket {
  count: number;
  resetTime: number; // ms timestamp
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private defaultLimit: number;
  private defaultWindowMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options?: { defaultLimit?: number; defaultWindowMs?: number; cleanupIntervalMs?: number }) {
    this.defaultLimit = options?.defaultLimit ?? 60; // 60 requests
    this.defaultWindowMs = options?.defaultWindowMs ?? 60 * 1000; // 1 minute

    const cleanupInterval = options?.cleanupIntervalMs ?? 120 * 1000;
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.purgeExpired(), cleanupInterval);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === "function") {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Check and consume one token for the given key
   */
  check(key: string, limit?: number, windowMs?: number): RateLimitResult {
    const max = limit ?? this.defaultLimit;
    const windowDuration = windowMs ?? this.defaultWindowMs;
    const now = Date.now();

    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetTime) {
      // First request in a new window
      const resetTime = now + windowDuration;
      this.buckets.set(key, { count: 1, resetTime });

      return {
        allowed: true,
        limit: max,
        remaining: Math.max(0, max - 1),
        reset: Math.ceil(resetTime / 1000),
        retryAfter: 0,
      };
    }

    // Existing window
    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const reset = Math.ceil(bucket.resetTime / 1000);
    const retryAfter = Math.max(0, Math.ceil((bucket.resetTime - now) / 1000));

    if (bucket.count > max) {
      return {
        allowed: false,
        limit: max,
        remaining: 0,
        reset,
        retryAfter: retryAfter || 1,
      };
    }

    return {
      allowed: true,
      limit: max,
      remaining,
      reset,
      retryAfter: 0,
    };
  }

  /**
   * Reset rate limit bucket for a specific key
   */
  reset(key: string): boolean {
    return this.buckets.delete(key);
  }

  /**
   * Purge expired buckets to maintain memory safety
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetTime) {
        this.buckets.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Clear all rate limiting buckets
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Stop timer on destruction
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}

// Global Singleton RateLimiter instance
export const rateLimiter = new RateLimiter({
  defaultLimit: 60, // 60 requests
  defaultWindowMs: 60 * 1000, // per 60 seconds
});

/**
 * Extract client identifier (user ID or IP) from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // 1. Prefer authenticated user ID (set by proxy.ts or custom auth header)
  const userId = request.headers.get("x-user-id");
  if (userId) return `user:${userId}`;

  // 2. Client IP extraction from standard headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0].trim();
    if (clientIp) return `ip:${clientIp}`;
  }

  const realIp =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("fastly-client-ip") ||
    request.headers.get("x-cluster-client-ip");

  if (realIp) return `ip:${realIp.trim()}`;

  // Fallback
  return "client:anonymous";
}

/**
 * Format rate limit headers from result
 */
export function formatRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}
