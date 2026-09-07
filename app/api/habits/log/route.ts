import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Habit from "@/lib/db/models/Habit";
import { getTodayDateString, getCairoMidnightUTC } from "@/lib/fitness/timezone";
import { parseISO } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { habitId, dateString, action } = body;

    if (!habitId || typeof habitId !== "string") {
      return NextResponse.json({ success: false, error: "habitId is required" }, { status: 400 });
    }

    await getDb();

    // Verify habit exists and belongs to user
    let habit = null;
    if (mongoose.Types.ObjectId.isValid(habitId)) {
      habit = await Habit.findOne({ _id: habitId, userId: session.userId });
    }
    if (!habit) {
      return NextResponse.json({ success: false, error: "Habit not found" }, { status: 404 });
    }

    const targetDateStr = dateString || getTodayDateString();
    let targetDate = parseISO(targetDateStr);
    if (!targetDate || isNaN(targetDate.getTime())) {
      targetDate = getCairoMidnightUTC();
    }

    let updateOp: any;
    let isCompletedNow = false;

    if (action === "check") {
      updateOp = { $addToSet: { completedHabitIds: habitId } };
      isCompletedNow = true;
    } else if (action === "uncheck") {
      updateOp = { $pull: { completedHabitIds: habitId } };
      isCompletedNow = false;
    } else {
      // Toggle
      const existing = await DailyLog.findOne({
        userId: session.userId,
        dateString: targetDateStr,
      })
        .select("completedHabitIds")
        .lean();

      const isCompleted = (existing?.completedHabitIds || []).map(String).includes(habitId);
      if (isCompleted) {
        updateOp = { $pull: { completedHabitIds: habitId } };
        isCompletedNow = false;
      } else {
        updateOp = { $addToSet: { completedHabitIds: habitId } };
        isCompletedNow = true;
      }
    }

    const updatedLog = await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: targetDateStr },
      {
        ...updateOp,
        $set: { date: targetDate },
        $setOnInsert: {
          userId: session.userId,
          dateString: targetDateStr,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    ).lean();
    

    const completedHabitIds = (updatedLog?.completedHabitIds || []).map(String);

    return NextResponse.json({
      success: true,
      completedHabitIds,
      dateString: targetDateStr,
      isCompleted: isCompletedNow,
    });
  } catch (err: any) {
    console.error("Error logging habit:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    await getDb();

    const query: any = { userId: session.userId };
    if (from && to) {
      query.dateString = { $gte: from, $lte: to };
    } else if (from) {
      query.dateString = { $gte: from };
    }

    const [logs, activeHabitsCount] = await Promise.all([
      DailyLog.find(query).select("dateString completedHabitIds").lean(),
      Habit.countDocuments({ userId: session.userId, isActive: true }),
    ]);

    return NextResponse.json({
      success: true,
      logs: logs.map((l: any) => ({
        dateString: l.dateString,
        completedHabitIds: (l.completedHabitIds || []).map(String),
        count: (l.completedHabitIds || []).length,
      })),
      activeHabitsCount,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
