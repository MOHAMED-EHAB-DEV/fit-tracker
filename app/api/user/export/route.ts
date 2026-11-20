import { NextResponse } from "next/server";
import { route, notFound } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import BodyComp from "@/lib/db/models/BodyComp";
import Habit from "@/lib/db/models/Habit";
import PlannedEvent from "@/lib/db/models/PlannedEvent";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import Routine from "@/lib/db/models/Routine";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import PersonalRecord from "@/lib/db/models/PersonalRecord";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { localDateString } from "@/lib/time";

/** Upper bound per collection, so one export can never exhaust memory. */
const MAX_DOCUMENTS = 20_000;

/**
 * Everything the user has logged, as one JSON file. Secrets (the password
 * hash, the personal AI key, reset tokens) and signed photo addresses are
 * never included. Weights are in kilograms and lengths in centimetres.
 */
export const GET = route({ rateLimit: RATE_LIMITS.exportPerHour }, async ({ session }) => {
  await getDb();
  await ensureWorkoutsMigrated(session.userId);
  const userId = session.userId;

  const [user, dailyLogs, meals, bodyComposition, habits, plannedEvents, customExercises, routines, workouts, records] =
    await Promise.all([
      User.findById(userId)
        .select("name email role fitnessProfile preferences computed weeklyRoutine createdAt")
        .lean(),
      DailyLog.find({ userId }).select("-__v -userId").sort({ dateString: -1 }).limit(MAX_DOCUMENTS).lean(),
      Meal.find({ userId }).select("-__v -userId").sort({ dateString: -1, loggedAt: -1 }).limit(MAX_DOCUMENTS).lean(),
      BodyComp.find({ userId })
        .select("-__v -userId -photos.signedUrl -photos.urlExpiresAt")
        .sort({ checkInDate: -1 })
        .limit(MAX_DOCUMENTS)
        .lean(),
      Habit.find({ userId }).select("-__v -userId").sort({ order: 1 }).limit(MAX_DOCUMENTS).lean(),
      PlannedEvent.find({ userId }).select("-__v -userId").sort({ date: -1 }).limit(MAX_DOCUMENTS).lean(),
      ExerciseCatalog.find({ createdBy: userId, isCustom: true }).select("-__v").limit(MAX_DOCUMENTS).lean(),
      Routine.find({ userId }).select("-__v -userId").sort({ updatedAt: -1 }).limit(MAX_DOCUMENTS).lean(),
      WorkoutSession.find({ userId, status: "completed" })
        .select("-__v -userId")
        .sort({ endedAt: -1 })
        .limit(MAX_DOCUMENTS)
        .lean(),
      PersonalRecord.find({ userId }).select("-__v -userId").limit(MAX_DOCUMENTS).lean(),
    ]);

  if (!user) throw notFound("User not found");

  // The stored (encrypted) AI key never leaves the server.
  const preferences: Record<string, unknown> = { ...(user.preferences || {}) };
  delete preferences.customGeminiApiKey;

  const payload = {
    app: "FitTracker",
    exportVersion: "2.0",
    exportedAt: new Date().toISOString(),
    units: { weight: "kg", length: "cm", energy: "kcal", water: "ml" },
    user: {
      name: user.name,
      email: user.email,
      fitnessProfile: user.fitnessProfile,
      preferences,
      computed: user.computed,
      weeklyRoutine: user.weeklyRoutine,
      createdAt: user.createdAt,
    },
    counts: {
      dailyLogs: dailyLogs.length,
      meals: meals.length,
      bodyComposition: bodyComposition.length,
      habits: habits.length,
      plannedEvents: plannedEvents.length,
      customExercises: customExercises.length,
      routines: routines.length,
      workouts: workouts.length,
      personalRecords: records.length,
    },
    dailyLogs,
    meals,
    bodyComposition,
    habits,
    plannedEvents,
    customExercises,
    routines,
    workouts,
    personalRecords: records,
  };

  const fileDate = localDateString(new Date(), session.timezone);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fit-tracker-export-${fileDate}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
