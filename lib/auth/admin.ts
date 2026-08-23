// Admin auth utilities for use in API route handlers and Server Components.
// Always verifies role from DB — never trusts the JWT payload alone.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";
import { getDb } from "@/lib/db/mongoose";
import User, { type IUser } from "@/lib/db/models/User";

export type AdminUser = IUser & { _id: string };

/**
 * For use in API route handlers.
 * Reads x-user-id (set by middleware after JWT verification),
 * then fetches the user from DB and confirms role === "admin".
 *
 * Returns { user } on success or a NextResponse 401/403 on failure.
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: AdminUser } | NextResponse> {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await getDb();
  const user = await User.findById(userId).select("-passwordHash").lean();

  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
  }

  if ((user as any).role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });
  }

  if ((user as any).isBanned) {
    return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 });
  }

  return { user: user as unknown as AdminUser };
}

/**
 * For use in React Server Components (reads the token cookie directly).
 * Returns the full admin user doc, or null if not authenticated/not admin.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    await getDb();
    const user = await User.findById(payload.userId).select("-passwordHash").lean();
    if (!user) return null;

    // Check token version to invalidate old sessions
    if ((user as any).tokenVersion !== payload.tokenVersion) return null;

    if ((user as any).role !== "admin") return null;
    if ((user as any).isBanned) return null;

    return user as unknown as AdminUser;
  } catch {
    return null;
  }
}
