import "server-only";
import type { NextResponse } from "next/server";
import { signToken } from "@/lib/auth/jwt";
import { setTokenCookie } from "@/lib/auth/cookies";

/** Signs a session for the user and attaches it to the response as a cookie. */
export async function issueSession(
  response: NextResponse,
  user: { _id: unknown; email: string; name: string; tokenVersion?: number | null }
): Promise<void> {
  const token = await signToken({
    userId: String(user._id),
    email: user.email,
    name: user.name,
    tokenVersion: user.tokenVersion || 0,
  });
  setTokenCookie(response, token);
}
