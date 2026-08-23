import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Workout from "@/lib/db/models/Workout";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
  }

  await getDb();
  const user = await User.findById(id).select("-passwordHash").lean();
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  // Aggregate user stats
  const [workoutCount, mealCount, bodyCompCount] = await Promise.all([
    Workout.countDocuments({ userId: id }),
    Meal.countDocuments({ userId: id }),
    BodyComp.countDocuments({ userId: id }),
  ]);

  return NextResponse.json({
    success: true,
    user,
    stats: { workoutCount, mealCount, bodyCompCount },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  // Whitelist of patchable fields
  const allowed: Record<string, boolean> = {
    role: true,
    isBanned: true,
    "fitnessProfile.goal": true,
    "fitnessProfile.targetCalories": true,
    "fitnessProfile.targetProteinG": true,
    "fitnessProfile.activityLevel": true,
    "fitnessProfile.weightKg": true,
    "fitnessProfile.heightCm": true,
    "fitnessProfile.sex": true,
    "preferences.stepGoal": true,
    "preferences.waterGoalMl": true,
    "preferences.timezone": true,
    name: true,
  };

  const updateData: any = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowed[key]) {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  await getDb();
  const user = await User.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select("-passwordHash");

  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, user });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 });
  }

  // Prevent admin from deleting themselves
  if (id === (authResult.user as any)._id.toString()) {
    return NextResponse.json(
      { success: false, error: "Cannot delete your own admin account" },
      { status: 400 }
    );
  }

  await getDb();
  const user = await User.findById(id);
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  // Cascade delete all user data
  const uid = new mongoose.Types.ObjectId(id);
  await Promise.all([
    Workout.deleteMany({ userId: uid }),
    Meal.deleteMany({ userId: uid }),
    DailyLog.deleteMany({ userId: uid }),
    BodyComp.deleteMany({ userId: uid }),
    User.findByIdAndDelete(id),
  ]);

  return NextResponse.json({
    success: true,
    message: "User and all associated data deleted",
  });
}
