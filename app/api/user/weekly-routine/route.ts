import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { DEFAULT_WEEKLY_ROUTINE } from "@/constants/workout";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();
    const user = await User.findById(session.userId).select("weeklyRoutine").lean();
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const weeklyRoutine = user.weeklyRoutine && user.weeklyRoutine.length === 7
      ? user.weeklyRoutine
      : DEFAULT_WEEKLY_ROUTINE;

    return NextResponse.json({ success: true, weeklyRoutine });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { weeklyRoutine } = body;

    if (!Array.isArray(weeklyRoutine) || weeklyRoutine.length !== 7) {
      return NextResponse.json(
        { success: false, error: "Weekly routine must specify all 7 days of the week" },
        { status: 400 }
      );
    }

    await getDb();
    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      { $set: { weeklyRoutine } },
      { returnDocument: "after" }
    ).select("weeklyRoutine");

    return NextResponse.json({ success: true, weeklyRoutine: updatedUser?.weeklyRoutine });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
