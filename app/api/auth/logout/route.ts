import { NextResponse } from "next/server";
import { clearTokenCookie } from "@/lib/auth/cookies";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  clearTokenCookie(response);
  return response;
}
