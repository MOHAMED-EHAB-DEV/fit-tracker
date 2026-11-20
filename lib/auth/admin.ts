// Admin authorization. Always re-checks the role in the database through the
// verified session — never trusts a request header or the JWT payload alone.
import "server-only";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getFullUser, LOGIN_REDIRECT } from "@/lib/auth/session";
import type { IUser } from "@/lib/db/models/User";

export type AdminUser = IUser & { _id: string };

/**
 * For Route Handlers. Returns { user } for an admin, or a 401/403 response.
 */
export async function requireAdmin(): Promise<{ user: AdminUser } | NextResponse> {
  const user = await getFullUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden: admin only" }, { status: 403 });
  }
  return { user: user as unknown as AdminUser };
}

/** For Server Components: the admin user, or null. */
export async function getAdminSession(): Promise<AdminUser | null> {
  const user = await getFullUser();
  if (!user || user.role !== "admin") return null;
  return user as unknown as AdminUser;
}

/**
 * For admin pages. Every admin page must call this itself before reading
 * data: a layout check alone does not stop a page from rendering.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  const user = await getFullUser();
  if (!user) redirect(LOGIN_REDIRECT);
  if (user.role !== "admin") redirect("/");
  return user as unknown as AdminUser;
}
