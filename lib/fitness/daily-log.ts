import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import User from "@/lib/db/models/User";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import { isValidDateString, localDateString } from "@/lib/time";
import { stepCalories } from "@/lib/fitness/steps";

/**
 * The daily log is a SUMMARY of a day. Its food and workout totals are always
 * rebuilt from the meals and workout sessions themselves (never adjusted with
 * +/- deltas), so the totals cannot drift away from what is actually logged.
 *
 * Steps, water and completed habits are owned by the log itself and are left
 * untouched here.
 */

export const DEFAULT_BMR_KCAL = 1700;

/** Rough active calories from walking. One place, used everywhere. */
export function stepsToCalories(steps: number | null | undefined): number {
  return stepCalories(steps);
}

const round1 = (value: number) => Math.round((value || 0) * 10) / 10;

export async function recomputeDay(userId: string, dateString: string): Promise<void> {
  if (!isValidDateString(dateString)) return;
  await getDb();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [mealTotals, sessions, existing, user] = await Promise.all([
    Meal.aggregate<{
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
    }>([
      { $match: { userId: userObjectId, dateString } },
      {
        $group: {
          _id: null,
          calories: { $sum: { $ifNull: ["$macros.calories", 0] } },
          protein: { $sum: { $ifNull: ["$macros.protein", 0] } },
          carbs: { $sum: { $ifNull: ["$macros.carbs", 0] } },
          fat: { $sum: { $ifNull: ["$macros.fat", 0] } },
          fiber: { $sum: { $ifNull: ["$macros.fiber", 0] } },
        },
      },
    ]),
    WorkoutSession.find({ userId: userObjectId, status: "completed", localDate: dateString })
      .select("name totals durationSec endedAt startedAt")
      .sort({ endedAt: 1 })
      .lean(),
    DailyLog.findOne({ userId: userObjectId, dateString }).select("steps caloriesOut").lean(),
    User.findById(userObjectId).select("computed.bmr preferences.timezone").lean(),
  ]);

  const food = mealTotals[0] || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const workoutCalories = sessions.reduce((sum, session) => sum + (session.totals?.calories || 0), 0);
  const steps = existing?.steps || 0;
  const stepCalories = stepsToCalories(steps);

  // Past days keep the BMR they were logged with; today follows the profile.
  const currentBmr = user?.computed?.bmr || DEFAULT_BMR_KCAL;
  const today = localDateString(new Date(), user?.preferences?.timezone);
  const bmr = dateString >= today ? currentBmr : existing?.caloriesOut?.bmr || currentBmr;

  const filter = { userId: userObjectId, dateString };
  const update = {
      $set: {
        caloriesIn: Math.round(food.calories),
        "macros.protein": round1(food.protein),
        "macros.carbs": round1(food.carbs),
        "macros.fat": round1(food.fat),
        "macros.fiber": round1(food.fiber),
        "caloriesOut.bmr": bmr,
        "caloriesOut.workouts": workoutCalories,
        "caloriesOut.steps": stepCalories,
        "caloriesOut.total": bmr + workoutCalories + stepCalories,
        workoutIds: sessions.map((session) => session._id),
        workoutEntries: sessions.map((session) => ({
          workoutId: session._id,
          name: session.name || "Workout",
          caloriesBurned: session.totals?.calories || 0,
          durationSeconds: session.durationSec ?? null,
          totalVolume: session.totals?.volumeKg || 0,
          loggedAt: session.endedAt || session.startedAt,
        })),
      },
      $setOnInsert: {
        date: new Date(`${dateString}T00:00:00.000Z`),
        waterMl: 0,
        waterEntries: [],
        steps: 0,
        completedHabitIds: [],
      },
  };

  try {
    await DailyLog.updateOne(filter, update, { upsert: true });
  } catch (err) {
    // Two first writes for the same day can race on the unique index: retry once.
    if ((err as { code?: number })?.code !== 11000) throw err;
    await DailyLog.updateOne(filter, update, { upsert: true });
  }
}

/** Recomputes several days (duplicates and invalid dates are ignored). */
export async function recomputeDays(userId: string, dateStrings: Array<string | null | undefined>): Promise<void> {
  const unique = Array.from(new Set(dateStrings.filter((value): value is string => isValidDateString(value))));
  for (const dateString of unique) {
    await recomputeDay(userId, dateString);
  }
}
