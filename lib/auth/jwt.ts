// Uses jose only (works in every Next.js runtime).
import { SignJWT, jwtVerify } from "jose";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
/** Tokens older than this are re-issued by the proxy (sliding session). */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a new 30-day session token. */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

/** Verify and decode a session token. Returns null if invalid or expired. */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.tokenVersion !== "number") {
      return null;
    }
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
