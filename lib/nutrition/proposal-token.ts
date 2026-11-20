import crypto from "node:crypto";
import type { Confidence } from "@/lib/nutrition/analysis";
import type { Macros } from "@/lib/nutrition/totals";

/**
 * A short-lived, signed copy of the AI's original estimate. The analyze route
 * hands it to the browser with the proposal; the save route only stores AI
 * metadata that comes back inside a valid token for the same user, so the
 * "AI estimate" on a meal is always what the model actually said.
 *
 * Server-only (node:crypto); never import from client components.
 */
export interface AiEstimate extends Macros {
  confidence: Confidence;
  confidenceReason: string;
  geminiNotes: string;
  modelUsed: string;
}

interface Claims {
  v: 1;
  u: string;
  exp: number;
  ai: AiEstimate;
}

export const PROPOSAL_TTL_MS = 6 * 60 * 60 * 1000;

function sign(body: string, secret: Buffer | string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

export function signProposalToken(
  userId: string,
  ai: AiEstimate,
  secret: Buffer | string,
  nowMs: number = Date.now()
): string {
  const claims: Claims = { v: 1, u: userId, exp: nowMs + PROPOSAL_TTL_MS, ai };
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

const CONFIDENCE = new Set(["high", "medium", "low"]);

/** The AI estimate inside a valid, unexpired token for `userId`; otherwise null. */
export function verifyProposalToken(
  token: string | undefined | null,
  userId: string,
  secret: Buffer | string,
  nowMs: number = Date.now()
): AiEstimate | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let claims: Claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Claims;
  } catch {
    return null;
  }
  if (!claims || claims.v !== 1 || claims.u !== userId || typeof claims.exp !== "number" || claims.exp < nowMs) {
    return null;
  }
  const ai = claims.ai;
  if (!ai || !CONFIDENCE.has(ai.confidence)) return null;
  for (const key of ["calories", "protein", "carbs", "fat", "fiber"] as const) {
    if (typeof ai[key] !== "number" || !Number.isFinite(ai[key]) || ai[key] < 0) return null;
  }
  return {
    calories: ai.calories,
    protein: ai.protein,
    carbs: ai.carbs,
    fat: ai.fat,
    fiber: ai.fiber,
    confidence: ai.confidence,
    confidenceReason: String(ai.confidenceReason || "").slice(0, 400),
    geminiNotes: String(ai.geminiNotes || "").slice(0, 600),
    modelUsed: String(ai.modelUsed || "").slice(0, 60),
  };
}

/** Key for proposal tokens, derived from the server secret (never the raw secret). */
export function proposalSecret(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("DATA_ENCRYPTION_KEY or JWT_SECRET must be configured");
  return Buffer.from(
    crypto.hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from("fit-tracker", "utf8"), Buffer.from("meal-proposal-v1", "utf8"), 32)
  );
}
