import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import LegacyWorkout from "@/lib/db/models/Workout";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import Routine from "@/lib/db/models/Routine";
import User from "@/lib/db/models/User";
import ExerciseCatalog, { resolveExerciseMeta } from "@/lib/db/models/ExerciseCatalog";
import { computeTotals, estimateSessionCalories, isSetLogged, plausibleDurationSec } from "@/lib/workouts/calc";
import { recomputeExerciseRecords } from "@/lib/workouts/records";
import { recomputeRoutineStats } from "@/lib/workouts/routine-stats";
import { recomputeDays } from "@/lib/fitness/daily-log";
import { toKg } from "@/lib/fitness/units";
import { localDateString, resolveTimeZone } from "@/lib/time";
import type { MuscleGroup, TrackingType } from "@/lib/workouts/taxonomy";
import type { PrKind } from "@/lib/workouts/types";

/**
 * One-time, per-user conversion of the old `workouts` collection (where one
 * document was routine, live session and history at once) into separate
 * routines and workout sessions.
 *
 * It is non-destructive (the old documents are left as they are), safe to run
 * twice (sessions are keyed by the old workout id) and runs automatically the
 * first time a user opens anything workout-related.
 */

const migratedThisProcess = new Set<string>();

interface LegacySet {
  targetReps?: number | null;
  targetWeight?: number | null;
  completedReps?: number | null;
  weight?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  completedAt?: Date | null;
}

interface LegacyExercise {
  catalogId?: mongoose.Types.ObjectId | null;
  name?: string;
  muscleGroup?: string;
  weightUnit?: "kg" | "lbs";
  notes?: string | null;
  sets?: LegacySet[];
}

interface CatalogMeta {
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  trackingType: TrackingType;
  metValue: number;
}

function validRpe(value: unknown): number | null {
  const rpe = Number(value);
  return Number.isFinite(rpe) && rpe >= 1 && rpe <= 10 ? rpe : null;
}

/** Requests of this process that arrive while a migration runs wait for the same run. */
const runningMigrations = new Map<string, Promise<void>>();

export async function ensureWorkoutsMigrated(userId: string): Promise<void> {
  if (migratedThisProcess.has(userId)) return;
  const running = runningMigrations.get(userId);
  if (running) return running;

  const run = migrateOnce(userId).finally(() => runningMigrations.delete(userId));
  runningMigrations.set(userId, run);
  return run;
}

async function migrateOnce(userId: string): Promise<void> {
  await getDb();

  // Claim the migration atomically so two requests never run it together.
  const claimed = await User.findOneAndUpdate(
    { _id: userId, $or: [{ "migrations.workoutsV3At": null }, { "migrations.workoutsV3At": { $exists: false } }] },
    { $set: { "migrations.workoutsV3At": new Date() } },
    { returnDocument: "before" }
  )
    .select("preferences.timezone fitnessProfile.weightKg weeklyRoutine")
    .lean();

  if (!claimed) {
    migratedThisProcess.add(userId);
    return;
  }

  try {
    await migrateUser(userId, {
      timezone: resolveTimeZone(claimed.preferences?.timezone),
      bodyWeightKg: claimed.fitnessProfile?.weightKg ?? null,
      weeklyRoutine: claimed.weeklyRoutine || [],
    });
    migratedThisProcess.add(userId);
  } catch (err) {
    // Release the claim so the next request retries.
    await User.updateOne({ _id: userId }, { $set: { "migrations.workoutsV3At": null } }).catch(() => undefined);
    console.error("[workouts migration] failed for user", userId, err);
    throw err;
  }
}

async function migrateUser(
  userId: string,
  context: {
    timezone: string;
    bodyWeightKg: number | null;
    weeklyRoutine: Array<{ dayOfWeek: string; workoutName: string; isRestDay: boolean }>;
  }
): Promise<void> {
  const legacy = await LegacyWorkout.find({ userId }).sort({ createdAt: 1 }).lean();
  if (legacy.length === 0) return;

  const catalogIds = Array.from(
    new Set(
      legacy.flatMap((workout) =>
        ((workout.exercises || []) as LegacyExercise[]).map((exercise) => String(exercise.catalogId || "")).filter(Boolean)
      )
    )
  );
  const catalogDocs = await ExerciseCatalog.find({ _id: { $in: catalogIds } })
    .select("name normalizedName primaryMuscle muscleGroup equipment category trackingType metValue")
    .lean();
  const catalog = new Map<string, CatalogMeta>();
  for (const doc of catalogDocs) {
    const meta = resolveExerciseMeta(doc);
    catalog.set(String(doc._id), {
      name: doc.name,
      primaryMuscle: doc.primaryMuscle,
      muscleGroup: meta.muscleGroup,
      trackingType: meta.trackingType,
      metValue: typeof doc.metValue === "number" && doc.metValue >= 1 ? doc.metValue : 5,
    });
  }

  const affectedExercises = new Set<string>();
  const affectedRoutines = new Set<string>();
  const affectedDays = new Set<string>();
  const routineIdByName = new Map<string, mongoose.Types.ObjectId>();
  const routineIdByDay = new Map<string, mongoose.Types.ObjectId>();

  const existingRoutines = await Routine.find({ userId, archivedAt: null }).select("name").lean();
  for (const routine of existingRoutines) routineIdByName.set(routine.name.trim().toLowerCase(), routine._id);

  for (const workout of legacy) {
    const exercises = ((workout.exercises || []) as LegacyExercise[]).filter(
      (exercise) => exercise.catalogId && catalog.has(String(exercise.catalogId))
    );

    // ---- Routine (the plan) ------------------------------------------------
    const routineKey = (workout.name || "Workout").trim().toLowerCase();
    if (exercises.length > 0 && !routineIdByName.has(routineKey)) {
      const routine = await Routine.create({
        userId,
        name: (workout.name || "Workout").trim().slice(0, 80),
        exercises: exercises.map((exercise) => {
          const meta = catalog.get(String(exercise.catalogId))!;
          const unit: "kg" | "lbs" = exercise.weightUnit || workout.weightUnit || "kg";
          return {
            exerciseId: exercise.catalogId as mongoose.Types.ObjectId,
            name: meta.name,
            primaryMuscle: meta.primaryMuscle,
            muscleGroup: meta.muscleGroup,
            trackingType: meta.trackingType,
            unit,
            restSec: null,
            notes: exercise.notes || "",
            sets: (exercise.sets || []).map((set) => {
              const reps = set.targetReps ?? set.completedReps ?? null;
              const weight = set.targetWeight ?? set.weight ?? null;
              return {
                type: (set.isWarmup ? "warmup" : "working") as "warmup" | "working",
                repMin: reps,
                repMax: reps,
                targetWeightKg: weight != null ? toKg(weight, unit) : null,
                targetDurationSec: null,
                targetRpe: null,
              };
            }),
          };
        }),
      });
      routineIdByName.set(routineKey, routine._id);
    }
    const routineId = routineIdByName.get(routineKey) || null;
    if (routineId && workout.dayOfWeek && !routineIdByDay.has(workout.dayOfWeek)) {
      routineIdByDay.set(workout.dayOfWeek, routineId);
    }

    // ---- Session (what was actually done) ----------------------------------
    if (workout.status !== "completed") continue;
    const already = await WorkoutSession.exists({ legacyWorkoutId: workout._id });
    if (already) continue;

    const sessionExercises = exercises
      .map((exercise) => {
        const meta = catalog.get(String(exercise.catalogId))!;
        const unit: "kg" | "lbs" = exercise.weightUnit || workout.weightUnit || "kg";
        const sets = (exercise.sets || [])
          .map((set) => ({
            type: (set.isWarmup ? "warmup" : "working") as "warmup" | "working",
            weightKg: set.weight != null ? toKg(Math.max(0, set.weight), unit) : meta.trackingType === "weight_reps" ? null : 0,
            reps: set.completedReps != null && set.completedReps > 0 ? Math.round(set.completedReps) : null,
            durationSec: null,
            distanceM: null,
            rpe: validRpe(set.rpe),
            done: Boolean(set.completedReps && set.completedReps > 0),
            doneAt: set.completedAt || null,
            targetRepMin: set.targetReps ?? null,
            targetRepMax: set.targetReps ?? null,
            targetWeightKg: set.targetWeight != null ? toKg(set.targetWeight, unit) : null,
            targetDurationSec: null,
            prKinds: [] as PrKind[],
          }))
          .filter((set) => isSetLogged(set, meta.trackingType));
        return {
          exerciseId: exercise.catalogId as mongoose.Types.ObjectId,
          name: meta.name,
          primaryMuscle: meta.primaryMuscle,
          muscleGroup: meta.muscleGroup,
          trackingType: meta.trackingType,
          unit,
          restSec: null,
          notes: exercise.notes || "",
          supersetGroup: null,
          metValue: meta.metValue,
          sets,
        };
      })
      .filter((exercise) => exercise.sets.length > 0);

    // A "completed" workout with nothing logged has no history to keep.
    if (sessionExercises.length === 0) continue;

    const totals = computeTotals(sessionExercises);
    // Old durations were measured from the wrong start time; keep them only
    // when plausible for the number of sets logged.
    const legacyDuration = workout.durationSeconds || 0;
    const plausible =
      legacyDuration >= totals.completedSets * 30 && legacyDuration <= totals.completedSets * 360 + 900
        ? legacyDuration
        : null;
    const durationSec = plausibleDurationSec(plausible, totals.completedSets);
    const endedAt = new Date(workout.completedAt || workout.date || workout.startedAt || workout.createdAt);
    const startedAt = new Date(endedAt.getTime() - durationSec * 1000);
    const localDate = localDateString(startedAt, context.timezone);

    await WorkoutSession.create({
      userId,
      routineId,
      name: (workout.name || "Workout").trim().slice(0, 80),
      status: "completed",
      startedAt,
      endedAt,
      durationSec,
      timezone: context.timezone,
      localDate,
      exercises: sessionExercises,
      totals: {
        ...totals,
        calories: estimateSessionCalories({
          exercises: sessionExercises,
          durationSec,
          bodyWeightKg: context.bodyWeightKg,
        }),
        prCount: 0,
      },
      version: 1,
      legacyWorkoutId: workout._id,
    });

    for (const exercise of sessionExercises) affectedExercises.add(String(exercise.exerciseId));
    if (routineId) affectedRoutines.add(String(routineId));
    affectedDays.add(localDate);
    // The day the old code credited (server clock) may differ from the real one.
    affectedDays.add(localDateString(endedAt, "UTC"));
    affectedDays.add(localDateString(endedAt, context.timezone));
  }

  // ---- Weekly schedule: link each day to its routine by id ------------------
  if (context.weeklyRoutine.length > 0) {
    const updated = context.weeklyRoutine.map((day) => {
      if (day.isRestDay) return { ...day, routineId: null };
      const byName = routineIdByName.get((day.workoutName || "").trim().toLowerCase());
      return { ...day, routineId: byName || routineIdByDay.get(day.dayOfWeek) || null };
    });
    await User.updateOne({ _id: userId }, { $set: { weeklyRoutine: updated } });
  }

  await recomputeExerciseRecords(userId, Array.from(affectedExercises));
  await recomputeRoutineStats(userId, Array.from(affectedRoutines));
  await recomputeDays(userId, Array.from(affectedDays));
}
