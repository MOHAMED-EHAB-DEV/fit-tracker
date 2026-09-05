import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import { getTodayDateString, getWeekStartDateString } from "@/lib/fitness/timezone";
import { calculateSessionDoneCalories, calculateRoutinePlannedCalories } from "@/lib/fitness/workout-calories";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    await getDb();

    const query: any = { userId: session.userId };
    if (status) {
      query.status = status;
    }

    const workouts = await Workout.find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, workouts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { DEFAULT_WORKOUT_TEMPLATES } from "@/lib/fitness/default-templates";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, templateId, exercises, weightUnit } = body;

    await getDb();

    const userDoc = await User.findById(session.userId).select("fitnessProfile.weightKg").lean();
    const userWeightKg = userDoc?.fitnessProfile?.weightKg ?? 0;

    const workoutDate = body.startedAt || body.date ? new Date(body.startedAt || body.date) : new Date();
    const weekStartDate = getWeekStartDateString(workoutDate);
    const dayOfWeek = (body.dayOfWeek || "saturday").toLowerCase();
    const status = body.status || "in_progress";

    let totalVolume = 0;
    let exerciseList = exercises || [];

    // Auto-populate exercises if templateId is specified and exercises array is empty
    if (exerciseList.length === 0 && templateId) {
      if (typeof templateId === "string" && templateId.startsWith("curated-")) {
        const curated = DEFAULT_WORKOUT_TEMPLATES.find((t) => t._id === templateId);
        if (curated) {
          exerciseList = curated.exercises.map((ex) => {
            const targetReps = parseInt(ex.repRange.split("-")[1] || ex.repRange.split("-")[0], 10) || 10;
            return {
              name: ex.name,
              muscleGroup: ex.muscleGroup,
              sets: Array.from({ length: ex.sets }).map(() => ({
                targetReps,
                targetWeight: null,
                completedReps: null,
                weight: null,
                rpe: null,
                isWarmup: false,
                isPR: false,
              })),
            };
          });
        }
      } else {
        const WorkoutTemplate = (await import("@/lib/db/models/WorkoutTemplate")).default;
        const dbTpl = await WorkoutTemplate.findById(templateId).lean();
        if (dbTpl) {
          exerciseList = dbTpl.exercises.map((ex: any) => {
            const targetReps = parseInt(ex.repRange.split("-")[1] || ex.repRange.split("-")[0], 10) || 10;
            return {
              name: ex.name,
              catalogId: ex.catalogId,
              sets: Array.from({ length: ex.sets }).map(() => ({
                targetReps,
                targetWeight: null,
                completedReps: null,
                weight: null,
                rpe: null,
                isWarmup: false,
                isPR: false,
              })),
            };
          });
        }
      }
    }

    const catalogIds = exerciseList.map((e: any) => e.catalogId).filter(Boolean);
    const catalogDocs = await ExerciseCatalog.find({ _id: { $in: catalogIds } }).select("_id metValue").lean();
    const metMap = new Map(catalogDocs.map((c: any) => [c._id.toString(), c.metValue]));

    for (const ex of exerciseList) {
      if (!ex.metValue && ex.catalogId) {
        ex.metValue = metMap.get(ex.catalogId.toString());
      }

      const isLbs = (ex.weightUnit || weightUnit) === "lbs";
      if (Array.isArray(ex.sets)) {
        for (const s of ex.sets) {
          const reps = s.completedReps || (status !== "completed" ? s.targetReps : null);
          const weight = s.weight !== null && s.weight !== undefined ? s.weight : (status !== "completed" ? s.targetWeight : null);
          if (reps && weight) {
            const setVol = reps * weight;
            totalVolume += isLbs ? Math.round(setVol / 2.20462) : setVol;
          }
        }
      }
    }

    const estimatedCalories =
      status === "completed"
        ? calculateSessionDoneCalories(exerciseList, userWeightKg)
        : calculateRoutinePlannedCalories(exerciseList, userWeightKg);

    const workout = await Workout.create({
      userId: session.userId,
      name: name?.trim() || "Workout",
      dayOfWeek,
      templateId: templateId || null,
      status,
      startedAt: workoutDate,
      completedAt: status === "completed" ? workoutDate : null,
      weekStartDate,
      exercises: exerciseList,
      weightUnit: weightUnit || "kg",
      totalVolume,
      estimatedCalories,
      date: workoutDate,
    });

    if (status === "completed" && estimatedCalories > 0) {
      const logDateStr = getTodayDateString(workoutDate);
      await DailyLog.findOneAndUpdate(
        { userId: session.userId, dateString: logDateStr },
        {
          $inc: {
            "caloriesOut.workouts": estimatedCalories,
            "caloriesOut.total": estimatedCalories,
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true, workout }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
