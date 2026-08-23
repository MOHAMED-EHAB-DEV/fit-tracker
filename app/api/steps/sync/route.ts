import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || getTodayDateString();

    await getDb();

    const [user, log] = await Promise.all([
      User.findById(session.userId).select("preferences fitnessProfile computed").lean(),
      DailyLog.findOne({ userId: session.userId, dateString: dateStr }).lean(),
    ]);

    const stepGoal = (user as any)?.preferences?.stepGoal || 10000;
    const steps = log?.steps || 0;
    const stepCalories = log?.caloriesOut?.steps || Math.round(steps * 0.04);

    return NextResponse.json({
      success: true,
      date: dateStr,
      steps,
      stepGoal,
      stepCalories,
      stepsSyncedAt: log?.stepsSyncedAt || null,
      stepsSource: log?.stepsSource || "manual",
    });
  } catch (err: any) {
    console.error("GET /api/steps/sync error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const steps = Number(body.steps);
    const source = body.source === "step_counter" ? "step_counter" : "manual";
    const dateStr = body.dateString || getTodayDateString();

    if (isNaN(steps) || steps < 0) {
      return NextResponse.json({ success: false, error: "Invalid steps value" }, { status: 400 });
    }

    await getDb();

    const [user, existingLog] = await Promise.all([
      User.findById(session.userId).lean(),
      DailyLog.findOne({ userId: session.userId, dateString: dateStr }).lean(),
    ]);

    const bmr = (user as any)?.computed?.bmr || 1800;
    const stepCalories = Math.round(steps * 0.04);
    const workoutCalories = existingLog?.caloriesOut?.workouts || 0;
    const totalCaloriesOut = bmr + workoutCalories + stepCalories;

    const updateDoc: any = {
      $set: {
        stepsSyncedAt: new Date(),
        stepsSource: source,
        "caloriesOut.bmr": bmr,
        "caloriesOut.steps": stepCalories,
        "caloriesOut.workouts": workoutCalories,
        "caloriesOut.total": totalCaloriesOut,
      },
      $setOnInsert: {
        date: new Date(),
        caloriesIn: 0,
        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
        waterMl: 0,
        waterEntries: [],
      },
    };

    if (source === "manual") {
      updateDoc.$set.steps = steps;
    } else {
      updateDoc.$max = { steps: steps };
    }

    const log = await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: dateStr },
      updateDoc,
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      updatedSteps: log.steps,
      stepCalories,
      totalCaloriesOut: log.caloriesOut?.total || totalCaloriesOut,
      date: dateStr,
      source,
    });
  } catch (err: any) {
    console.error("POST /api/steps/sync error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
