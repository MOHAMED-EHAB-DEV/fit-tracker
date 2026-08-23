import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { user } = result;

  return NextResponse.json({
    success: true,
    isAdmin: true,
    user: {
      _id: (user as any)._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}
