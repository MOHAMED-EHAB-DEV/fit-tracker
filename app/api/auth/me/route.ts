import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await getDb();
  const user = await User.findById(session.userId).select("-passwordHash").lean();
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const hasBiometrics = Boolean(
    (user as any).fitnessProfile?.weightKg &&
    (user as any).fitnessProfile?.heightCm &&
    (user as any).fitnessProfile?.sex
  );

  const isComplete = (user as any).isProfileComplete || hasBiometrics;
  (user as any).isProfileComplete = isComplete;

  return NextResponse.json({ success: true, user });
}
