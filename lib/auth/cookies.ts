// Helpers to set/clear the auth token cookie on NextResponse objects.
import { type NextResponse } from "next/server";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/jwt";

export const SESSION_COOKIE_NAME = "token";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // "lax" keeps the user signed in when they arrive from an external link,
  // while still blocking cross-site POST/PATCH/DELETE requests.
  sameSite: "lax" as const,
  path: "/",
};

export function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearTokenCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
}
