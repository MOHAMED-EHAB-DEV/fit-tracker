import { NextRequest, NextResponse } from "next/server";
import { signToken, verifyToken, SESSION_RENEW_AFTER_SECONDS } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME, setTokenCookie } from "@/lib/auth/cookies";

/**
 * Optimistic pre-filter only: it checks that a session cookie is present and
 * correctly signed, and blocks cross-site writes. It never reads the database.
 *
 * The real authorization (account exists, not banned, session not revoked,
 * admin role) happens in lib/auth/session.ts, which every page, Server
 * Function and Route Handler calls itself.
 */

const PUBLIC_API_PREFIXES = ["/api/auth/"];
/** Shown only to signed-out visitors (a signed-in one is sent to the app). */
const AUTH_PAGES = ["/login", "/signup"];
/** Open to everyone: a reset link must work even where another account is signed in. */
const PUBLIC_PAGES = ["/forgot-password", "/reset-password"];
/** The landing page's generated share image (/opengraph-image?<hash>). */
const PUBLIC_PREFIXES = ["/opengraph-image"];
/** The public landing page. A signed-in visitor goes straight to the app. */
const LANDING_PAGE = "/";
/** The signed-in home. */
const APP_HOME = "/dashboard";

function isCrossSiteWrite(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  const origin = request.headers.get("origin");
  // Native clients (the Android background sync) send no Origin header.
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && isCrossSiteWrite(request)) {
    return NextResponse.json({ success: false, error: "Cross-site request blocked" }, { status: 403 });
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (pathname === LANDING_PAGE) {
    // Installed PWAs and the Android app start at "/": signed-in people land
    // on Today, everyone else sees the landing page. (A revoked session is
    // caught by the app layout, which sends the visitor to /login.)
    return payload ? NextResponse.redirect(new URL(APP_HOME, request.url)) : NextResponse.next();
  }

  if (AUTH_PAGES.includes(pathname)) {
    // Already signed in: skip the auth screens. (A revoked session is caught
    // by the app layout, which clears it and sends the user back here.)
    if (request.nextUrl.searchParams.has("expired")) {
      // The app found this session revoked, banned or deleted: drop the cookie.
      const cleared = NextResponse.next();
      if (token) cleared.cookies.delete(SESSION_COOKIE_NAME);
      return cleared;
    }
    if (payload) {
      return NextResponse.redirect(new URL(APP_HOME, request.url));
    }
    return NextResponse.next();
  }

  if (!payload) {
    if (isApi) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.next();

  // Sliding session: re-issue tokens older than a week so active users are
  // never logged out mid-use. The claims (including tokenVersion) are copied
  // unchanged, so a revoked session stays revoked.
  const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (issuedAt > 0 && ageSeconds > SESSION_RENEW_AFTER_SECONDS) {
    const renewed = await signToken({
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      tokenVersion: payload.tokenVersion,
    });
    setTokenCookie(response, renewed);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals, the image proxy (public, hardened
     * separately) and static files.
     */
    "/((?!_next/static|_next/image|fit-tracker/images|favicon.ico|manifest.json|sw.js|icons/|offline.html|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|webmanifest)$).*)",
  ],
};
