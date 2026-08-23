import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();
    const user = await User.findById(session.userId).select("preferences").lean();
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, preferences: user.preferences });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await getDb();

    const updateFields: Record<string, any> = {};

    if (body.weightUnit && (body.weightUnit === "kg" || body.weightUnit === "lbs")) {
      updateFields["preferences.weightUnit"] = body.weightUnit;
    }
    if (body.stepGoal !== undefined) {
      updateFields["preferences.stepGoal"] = body.stepGoal;
    }
    if (body.waterGoalMl !== undefined) {
      updateFields["preferences.waterGoalMl"] = body.waterGoalMl;
    }
    if (body.timezone !== undefined) {
      updateFields["preferences.timezone"] = body.timezone;
    }

    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      { $set: updateFields },
      { new: true }
    ).select("preferences");

    return NextResponse.json({
      success: true,
      preferences: updatedUser?.preferences,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
