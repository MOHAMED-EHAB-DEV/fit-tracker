import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Workout from "@/lib/db/models/Workout";
import User from "@/lib/db/models/User";
import { getTodayDateString, getWeekStartDateString } from "@/lib/fitness/timezone";

/**
 * Checks whether an uncompleted workout was last touched on an earlier date.
 */
export function isWorkoutStaleIncomplete(workout: {
  status?: string;
  updatedAt?: Date | string;
  startedAt?: Date | string;
  createdAt?: Date | string;
}): boolean {
  if (workout.status === "completed") {
    return false;
  }
  const lastUpdated = workout.updatedAt || workout.startedAt || workout.createdAt;
  if (!lastUpdated) {
    return false;
  }
  const lastUpdatedDay = getTodayDateString(new Date(lastUpdated));
  const todayStr = getTodayDateString(new Date());
  return todayStr > lastUpdatedDay;
}

/**
 * Cleans in-memory workout data so all partially recorded or stale sets are wiped clean.
 */
export function cleanWorkoutData(workout: any): void {
  if (Array.isArray(workout.exercises)) {
    for (const ex of workout.exercises) {
      if (Array.isArray(ex.sets)) {
        for (const s of ex.sets) {
          s.completedReps = null;
          s.weight = null;
          s.completedAt = null;
          s.rpe = null;
          s.isPR = false;
          s.restSeconds = null;
        }
      }
      ex.oneRM = null;
    }
  }

  workout.totalVolume = 0;
  workout.estimatedCalories = 0;
  workout.completedAt = null;
  workout.durationSeconds = null;
  workout.status = "active";
  workout.startedAt = new Date();
  workout.date = new Date();
  workout.weekStartDate = getWeekStartDateString(new Date());
}

/**
 * Persists a cleaned reset state to the database for an incomplete stale workout.
 */
export async function cleanStaleWorkout(workoutDoc: any): Promise<void> {
  cleanWorkoutData(workoutDoc);
  if (typeof workoutDoc.save === "function") {
    await workoutDoc.save();
  }
}

/**
 * Syncs a completed workout with its date's DailyLog, updating burned calories,
 * workout IDs, and complete workout telemetry entries.
 */
export async function syncWorkoutToDailyLog(
  userId: string | mongoose.Types.ObjectId,
  workoutId: string | mongoose.Types.ObjectId,
  previousDateStr?: string
): Promise<void> {
  await getDb();

  const userObjId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  const workoutObjId = typeof workoutId === "string" ? new mongoose.Types.ObjectId(workoutId) : workoutId;

  const workout = await Workout.findById(workoutObjId).lean();

  if (!workout || workout.status !== "completed") {
    if (previousDateStr) {
      await removeWorkoutFromDailyLog(userObjId, workoutObjId, previousDateStr);
    }
    return;
  }

  const targetDateStr = getTodayDateString(
    workout.completedAt || workout.date || workout.startedAt || workout.createdAt
  );

  const user = await User.findById(userObjId).select("fitnessProfile computed").lean();
  const defaultBmr = (user as any)?.computed?.bmr || 1800;

  // Retrieve all completed workouts for the user on this date
  const allCompleted = await Workout.find({
    userId: userObjId,
    status: "completed",
  }).lean();

  const dayWorkouts = allCompleted.filter((w: any) => {
    const wDateStr = getTodayDateString(w.completedAt || w.date || w.startedAt || w.createdAt);
    return wDateStr === targetDateStr;
  });

  const totalWorkoutCalories = dayWorkouts.reduce(
    (sum: number, w: any) => sum + (w.estimatedCalories || 0),
    0
  );

  const workoutEntries = dayWorkouts.map((w: any) => ({
    workoutId: w._id,
    name: w.name || "Workout",
    caloriesBurned: w.estimatedCalories || 0,
    durationSeconds: w.durationSeconds ?? null,
    totalVolume: w.totalVolume || 0,
    loggedAt: w.completedAt || w.date || w.startedAt || w.createdAt || new Date(),
  }));

  const workoutIds = dayWorkouts.map((w: any) => w._id);

  const existingLog = await DailyLog.findOne({ userId: userObjId, dateString: targetDateStr }).lean();
  const stepCalories = existingLog?.caloriesOut?.steps || Math.round((existingLog?.steps || 0) * 0.04);
  const bmr = existingLog?.caloriesOut?.bmr || defaultBmr;
  const totalCaloriesOut = bmr + totalWorkoutCalories + stepCalories;
  const logDate = new Date(workout.completedAt || workout.date || workout.startedAt || workout.createdAt || new Date());

  await DailyLog.findOneAndUpdate(
    { userId: userObjId, dateString: targetDateStr },
    {
      $set: {
        "caloriesOut.bmr": bmr,
        "caloriesOut.workouts": totalWorkoutCalories,
        "caloriesOut.steps": stepCalories,
        "caloriesOut.total": totalCaloriesOut,
        workoutEntries,
        workoutIds,
      },
      $setOnInsert: {
        date: logDate,
        caloriesIn: 0,
        macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
        waterMl: 0,
        waterEntries: [],
        steps: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // If workout moved from a previous date, recalculate the previous date's log
  if (previousDateStr && previousDateStr !== targetDateStr) {
    await removeWorkoutFromDailyLog(userObjId, workoutObjId, previousDateStr);
  }
}

/**
 * Removes a workout from a specific date's DailyLog and recalculates total calories burned.
 */
export async function removeWorkoutFromDailyLog(
  userId: string | mongoose.Types.ObjectId,
  workoutId: string | mongoose.Types.ObjectId,
  dateStr: string
): Promise<void> {
  await getDb();

  const userObjId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  const workoutObjId = typeof workoutId === "string" ? new mongoose.Types.ObjectId(workoutId) : workoutId;

  const user = await User.findById(userObjId).select("fitnessProfile computed").lean();
  const defaultBmr = (user as any)?.computed?.bmr || 1800;

  const remainingWorkouts = await Workout.find({
    userId: userObjId,
    status: "completed",
    _id: { $ne: workoutObjId },
  }).lean();

  const dayRemaining = remainingWorkouts.filter((w: any) => {
    const wDateStr = getTodayDateString(w.completedAt || w.date || w.startedAt || w.createdAt);
    return wDateStr === dateStr;
  });

  const totalWorkoutCalories = dayRemaining.reduce(
    (sum: number, w: any) => sum + (w.estimatedCalories || 0),
    0
  );

  const workoutEntries = dayRemaining.map((w: any) => ({
    workoutId: w._id,
    name: w.name || "Workout",
    caloriesBurned: w.estimatedCalories || 0,
    durationSeconds: w.durationSeconds ?? null,
    totalVolume: w.totalVolume || 0,
    loggedAt: w.completedAt || w.date || w.startedAt || w.createdAt || new Date(),
  }));

  const workoutIds = dayRemaining.map((w: any) => w._id);

  const existingLog = await DailyLog.findOne({ userId: userObjId, dateString: dateStr }).lean();
  if (existingLog) {
    const stepCalories = existingLog.caloriesOut?.steps || Math.round((existingLog.steps || 0) * 0.04);
    const bmr = existingLog.caloriesOut?.bmr || defaultBmr;
    const totalCaloriesOut = bmr + totalWorkoutCalories + stepCalories;

    await DailyLog.findOneAndUpdate(
      { userId: userObjId, dateString: dateStr },
      {
        $set: {
          "caloriesOut.workouts": totalWorkoutCalories,
          "caloriesOut.total": totalCaloriesOut,
          workoutEntries,
          workoutIds,
        },
      }
    );
  }
}
