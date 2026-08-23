// Helpers to set/clear the auth token cookie on NextResponse objects.
import { type NextResponse } from "next/server";

const COOKIE_NAME = "token";
const MAX_AGE_30_DAYS = 60 * 60 * 24 * 30; // 2592000 seconds

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: MAX_AGE_30_DAYS,
  });
}

export function clearTokenCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}
