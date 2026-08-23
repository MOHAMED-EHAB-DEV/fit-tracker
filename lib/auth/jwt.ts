// 100% edge-compatible — uses jose only, never jsonwebtoken
import { SignJWT, jwtVerify, decodeJwt } from "jose";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  tokenVersion: number;
}

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET!);

/**
 * Sign a new 30-day JWT.
 * Never call this from Edge Runtime — only from Node.js API routes.
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

/**
 * Verify and decode a JWT. Returns null if invalid or expired.
 * Safe to call from Edge Runtime (proxy.ts).
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT without verifying (for client-safe reads).
 * Never trust this for auth — only for displaying user info.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return decodeJwt(token) as unknown as JWTPayload;
  } catch {
    return null;
  }
}
