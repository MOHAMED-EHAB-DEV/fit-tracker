import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import { calculateOneRM } from "@/lib/fitness/one-rm";
import { getTodayDateString, getWeekStartDateString } from "@/lib/fitness/timezone";
import { calculateSessionDoneCalories, calculateRoutinePlannedCalories } from "@/lib/fitness/workout-calories";

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

    const prevStatus: string = existing.status;
    const prevCalories = existing.estimatedCalories || 0;

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

    // Retrieve user weight for accurate calorie expenditure
    const userDoc = await User.findById(session.userId).select("fitnessProfile.weightKg").lean();
    const userWeightKg = userDoc?.fitnessProfile?.weightKg ?? 0;

    if (Array.isArray(body.exercises)) {
      let totalVol = 0;

      // Ensure metValue is populated from ExerciseCatalog in DB
      const catalogIds = body.exercises.map((e: any) => e.catalogId).filter(Boolean);
      const catalogDocs = await ExerciseCatalog.find({ _id: { $in: catalogIds } }).select("_id metValue").lean();
      const metMap = new Map(catalogDocs.map((c: any) => [c._id.toString(), c.metValue]));

      for (const ex of body.exercises) {
        if (!ex.metValue && ex.catalogId) {
          ex.metValue = metMap.get(ex.catalogId.toString());
        }

        let maxWorkingOneRM = 0;
        const isLbs = ex.weightUnit === "lbs";
        if (Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            const isSetWarmup = !!s.isWarmup;
            const reps = s.completedReps || (existing.status !== "completed" ? s.targetReps : null);
            const weight = s.weight !== null && s.weight !== undefined ? s.weight : (existing.status !== "completed" ? s.targetWeight : null);

            if (reps && weight) {
              const setVol = reps * weight;
              totalVol += isLbs ? Math.round(setVol / 2.20462) : setVol;

              if (s.completedReps && s.weight && !isSetWarmup) {
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

      if (existing.status === "completed") {
        // Calculate calories strictly based on what was DONE in the session
        existing.estimatedCalories = calculateSessionDoneCalories(body.exercises, userWeightKg);
      } else {
        // Calculate total planned calories directly on routine update
        existing.estimatedCalories = calculateRoutinePlannedCalories(body.exercises, userWeightKg);
      }
    }

    await existing.save();

    // If session is completed, accurately sync calories burned to DailyLog
    if (existing.status === "completed") {
      const currentCal = existing.estimatedCalories || 0;
      const caloriesToApply = prevStatus === "completed" ? currentCal - prevCalories : currentCal;

      if (caloriesToApply !== 0) {
        const logDateStr = getTodayDateString(existing.completedAt || existing.date || existing.startedAt);
        const logDate = existing.completedAt || existing.date || existing.startedAt || new Date();
        await DailyLog.findOneAndUpdate(
          { userId: session.userId, dateString: logDateStr },
          {
            $inc: {
              "caloriesOut.workouts": caloriesToApply,
              "caloriesOut.total": caloriesToApply,
            },
            $setOnInsert: {
              date: logDate,
            },
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    } else if (prevStatus === "completed") {
      // Reverted from completed back to active/routine: deduct previously logged calories
      if (prevCalories > 0) {
        const logDateStr = getTodayDateString(existing.completedAt || existing.date || existing.startedAt);
        const logDate = existing.completedAt || existing.date || existing.startedAt || new Date();
        await DailyLog.findOneAndUpdate(
          { userId: session.userId, dateString: logDateStr },
          {
            $inc: {
              "caloriesOut.workouts": -prevCalories,
              "caloriesOut.total": -prevCalories,
            },
            $setOnInsert: {
              date: logDate,
            },
          },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
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

    const existing = await Workout.findOne({ _id: id, userId: session.userId });
    if (existing) {
      if (existing.status === "completed" && existing.estimatedCalories > 0) {
        const logDateStr = getTodayDateString(existing.completedAt || existing.date || existing.startedAt);
        await DailyLog.findOneAndUpdate(
          { userId: session.userId, dateString: logDateStr },
          {
            $inc: {
              "caloriesOut.workouts": -existing.estimatedCalories,
              "caloriesOut.total": -existing.estimatedCalories,
            },
          }
        );
      }
      await Workout.deleteOne({ _id: id, userId: session.userId });
    }
    return NextResponse.json({ success: true, message: "Workout deleted" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
