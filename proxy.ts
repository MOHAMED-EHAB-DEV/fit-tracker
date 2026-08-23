import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  const token = request.cookies.get("token")?.value;

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (isApiRoute) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("token");
    return response;
  }

  // Forward userId to route handlers via header (avoids re-parsing JWT)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", String(payload.userId));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Protect all (app) pages, onboarding, admin panel, and all API routes except /api/auth/*
  matcher: ["/(app)/:path*", "/onboarding", "/admin/:path*", "/api/((?!auth).*)"],
};

