import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import DailyLog from "@/lib/db/models/DailyLog";
import { calculateOneRM } from "@/lib/fitness/one-rm";
import { getTodayDateString, getWeekStartDateString } from "@/lib/fitness/timezone";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await getDb();
    const workout = await Workout.findOne({
      _id: id,
      userId: session.userId,
    }).lean();

    if (!workout) {
      return NextResponse.json({ success: false, error: "Workout not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, workout });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    await getDb();

    const existing = await Workout.findOne({ _id: id, userId: session.userId });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Workout not found" }, { status: 404 });
    }

    if (body.name !== undefined && typeof body.name === "string") {
      existing.name = body.name.trim();
    }

    if (body.status !== undefined) {
      existing.status = body.status;
    }

    if (body.weightUnit !== undefined && (body.weightUnit === "kg" || body.weightUnit === "lbs")) {
      existing.weightUnit = body.weightUnit;
    }

    if (body.dayOfWeek !== undefined && typeof body.dayOfWeek === "string") {
      existing.dayOfWeek = body.dayOfWeek.toLowerCase() as any;
    } else if (!existing.dayOfWeek) {
      existing.dayOfWeek = "saturday";
    }

    if (body.startedAt || body.date) {
      const newDate = new Date(body.startedAt || body.date);
      existing.startedAt = newDate;
      existing.date = newDate;
      existing.weekStartDate = getWeekStartDateString(newDate);
    } else {
      if (!existing.startedAt) existing.startedAt = new Date();
      if (!existing.date) existing.date = existing.startedAt;
      if (!existing.weekStartDate) existing.weekStartDate = getWeekStartDateString(existing.startedAt);
    }

    if (body.status === "completed" && !existing.completedAt) {
      existing.completedAt = new Date();
      existing.durationSeconds = Math.round(
        (existing.completedAt.getTime() - new Date(existing.startedAt).getTime()) / 1000
      );
    }

    if (Array.isArray(body.exercises)) {
      let totalVol = 0;

      for (const ex of body.exercises) {
        let maxWorkingOneRM = 0;
        const isLbs = ex.weightUnit === "lbs";
        if (Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            const isSetWarmup = !!s.isWarmup;
            if (s.completedReps && s.weight) {
              const setVol = s.completedReps * s.weight;
              totalVol += isLbs ? Math.round(setVol / 2.20462) : setVol;

              if (!isSetWarmup) {
                const oneRM = calculateOneRM(s.weight, s.completedReps);
                if (oneRM > maxWorkingOneRM) maxWorkingOneRM = oneRM;

                // Check PR against prior workouts for this exercise
                const priorMax = await Workout.aggregate([
                  {
                    $match: {
                      userId: existing.userId,
                      _id: { $ne: existing._id },
                      status: "completed",
                      "exercises.catalogId": ex.catalogId,
                    },
                  },
                  { $unwind: "$exercises" },
                  { $match: { "exercises.catalogId": ex.catalogId } },
                  { $group: { _id: null, max1RM: { $max: "$exercises.oneRM" } } },
                ]);

                const priorRecord = priorMax[0]?.max1RM || 0;
                s.isPR = priorRecord > 0 && oneRM > priorRecord;
              }
            }
          }
        }
        ex.oneRM = maxWorkingOneRM > 0 ? maxWorkingOneRM : null;
      }

      existing.exercises = body.exercises;
      existing.totalVolume = totalVol;
      // Approximate calories burned: ~5.5 kcal per min of training
      const durationMins = (existing.durationSeconds || 3600) / 60;
      existing.estimatedCalories = Math.round(durationMins * 5.5);
    }

    await existing.save();

    // If completed, add burned calories to DailyLog
    if (existing.status === "completed" && existing.estimatedCalories > 0) {
      const todayStr = getTodayDateString();
      await DailyLog.findOneAndUpdate(
        { userId: session.userId, dateString: todayStr },
        {
          $inc: {
            "caloriesOut.workouts": existing.estimatedCalories,
            "caloriesOut.total": existing.estimatedCalories,
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true, workout: existing });
  } catch (err: any) {
    console.error("Workout PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await getDb();

    await Workout.deleteOne({ _id: id, userId: session.userId });
    return NextResponse.json({ success: true, message: "Workout deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
