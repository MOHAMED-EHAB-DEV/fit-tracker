import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import WorkoutSession, {
  type ISessionExercise,
  type ISessionSet,
  type IWorkoutSession,
} from "@/lib/db/models/WorkoutSession";
import Routine from "@/lib/db/models/Routine";
import User from "@/lib/db/models/User";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { loadExerciseSnapshots, type ExerciseSnapshot } from "@/lib/workouts/exercises";
import { toSessionDTO, toSessionSummaryDTO } from "@/lib/workouts/mappers";
import {
  computeTotals,
  estimateOneRepMaxKg,
  estimateSessionCalories,
  isSetLogged,
  plausibleDurationSec,
} from "@/lib/workouts/calc";
import { recomputeExerciseRecords } from "@/lib/workouts/records";
import { recomputeRoutineStats } from "@/lib/workouts/routine-stats";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { recomputeDays } from "@/lib/fitness/daily-log";
import { localDateString, localWeekdayKey } from "@/lib/time";
import type { WeightUnit } from "@/lib/fitness/units";
import type {
  PreviousPerformanceDTO,
  PrKind,
  SessionDTO,
  SessionSummaryDTO,
} from "@/lib/workouts/types";
import type { SessionExerciseInput, SessionFinishInput, SessionSaveInput } from "@/lib/validation/workouts";

export interface Actor {
  userId: string;
  timezone: string;
  weightUnit: WeightUnit;
}

type SessionSetData = Omit<ISessionSet, "_id"> & { _id?: mongoose.Types.ObjectId };
type SessionExerciseData = Omit<ISessionExercise, "_id" | "sets"> & {
  _id?: mongoose.Types.ObjectId;
  sets: SessionSetData[];
};

const MAX_SESSION_SECONDS = 6 * 60 * 60;
const MAX_BACKDATE_MS = 3 * 365 * 24 * 60 * 60 * 1000;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildExercises(
  inputs: SessionExerciseInput[],
  snapshots: Map<string, ExerciseSnapshot>,
  defaultUnit: WeightUnit
): SessionExerciseData[] {
  const now = new Date();
  return inputs.map((input) => {
    const snapshot = snapshots.get(input.exerciseId);
    if (!snapshot) throw badRequest("One of the exercises is no longer available");
    return {
      ...(input.id ? { _id: new mongoose.Types.ObjectId(input.id) } : {}),
      exerciseId: new mongoose.Types.ObjectId(snapshot.exerciseId),
      name: snapshot.name,
      primaryMuscle: snapshot.primaryMuscle,
      muscleGroup: snapshot.muscleGroup,
      trackingType: snapshot.trackingType,
      unit: input.unit || defaultUnit,
      restSec: input.restSec ?? null,
      notes: input.notes || "",
      supersetGroup: input.supersetGroup ?? null,
      metValue: snapshot.metValue,
      sets: input.sets.map((set) => ({
        ...(set.id ? { _id: new mongoose.Types.ObjectId(set.id) } : {}),
        type: set.type,
        weightKg: set.weightKg ?? null,
        reps: set.reps ?? null,
        durationSec: set.durationSec ?? null,
        distanceM: set.distanceM ?? null,
        rpe: set.rpe ?? null,
        done: Boolean(set.done),
        doneAt: set.done ? (set.doneAt ? new Date(set.doneAt) : now) : null,
        targetRepMin: set.targetRepMin ?? null,
        targetRepMax: set.targetRepMax ?? null,
        targetWeightKg: set.targetWeightKg ?? null,
        targetDurationSec: set.targetDurationSec ?? null,
        prKinds: [] as PrKind[],
      })),
    };
  });
}

/** History records what was done, not what was planned: only logged sets are kept. */
function loggedOnly(exercises: SessionExerciseData[]): SessionExerciseData[] {
  return exercises
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => isSetLogged(set, exercise.trackingType)),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

function assertPlausibleStart(startedAt: Date): void {
  const now = Date.now();
  if (Number.isNaN(startedAt.getTime())) throw badRequest("That start time is not valid");
  if (startedAt.getTime() > now + 5 * 60_000) throw badRequest("A workout cannot start in the future");
  if (now - startedAt.getTime() > MAX_BACKDATE_MS) throw badRequest("That date is too far in the past");
}

function totalsFor(exercises: SessionExerciseData[], durationSec: number | null, bodyWeightKg: number | null) {
  const totals = computeTotals(exercises);
  return {
    ...totals,
    calories: estimateSessionCalories({ exercises, durationSec, bodyWeightKg }),
    prCount: 0,
  };
}

async function bodyWeightOf(userId: string): Promise<number | null> {
  const user = await User.findById(userId).select("fitnessProfile.weightKg").lean();
  return user?.fitnessProfile?.weightKg ?? null;
}

async function findOwned(userId: string, sessionId: string): Promise<IWorkoutSession> {
  const session = await WorkoutSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw notFound("Workout not found");
  return session as IWorkoutSession;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The workout currently in progress, if any. */
export async function getActiveSession(userId: string): Promise<SessionSummaryDTO | null> {
  await getDb();
  const session = await WorkoutSession.findOne({ userId, status: "in_progress" }).lean();
  return session ? toSessionSummaryDTO(session as IWorkoutSession) : null;
}

export async function getSession(userId: string, sessionId: string): Promise<SessionDTO> {
  await getDb();
  return toSessionDTO(await findOwned(userId, sessionId));
}

/** The current id of a workout that was converted from the pre-v3 `workouts` collection. */
export async function findSessionIdByLegacyId(userId: string, legacyWorkoutId: string): Promise<string | null> {
  if (!mongoose.isValidObjectId(legacyWorkoutId)) return null;
  await getDb();
  await ensureWorkoutsMigrated(userId);
  const session = await WorkoutSession.findOne({
    userId,
    legacyWorkoutId: new mongoose.Types.ObjectId(legacyWorkoutId),
  })
    .select("_id")
    .lean();
  return session ? String(session._id) : null;
}

/** What the user did the last time, for each exercise. */
export async function getPreviousPerformance(
  userId: string,
  exerciseIds: string[],
  excludeSessionId?: string
): Promise<PreviousPerformanceDTO[]> {
  const unique = Array.from(new Set(exerciseIds)).slice(0, 60);
  if (unique.length === 0) return [];
  await getDb();

  const results = await Promise.all(
    unique.map(async (exerciseId) => {
      const session = await WorkoutSession.findOne({
        userId,
        status: "completed",
        "exercises.exerciseId": exerciseId,
        ...(excludeSessionId ? { _id: { $ne: excludeSessionId } } : {}),
      })
        .select("endedAt startedAt exercises")
        .sort({ endedAt: -1 })
        .lean();
      if (!session) return null;

      const sets = session.exercises
        .filter((exercise) => String(exercise.exerciseId) === exerciseId)
        .flatMap((exercise) => exercise.sets.filter((set) => isSetLogged(set, exercise.trackingType)))
        .map((set) => ({
          type: set.type,
          weightKg: set.weightKg ?? null,
          reps: set.reps ?? null,
          durationSec: set.durationSec ?? null,
          distanceM: set.distanceM ?? null,
          rpe: set.rpe ?? null,
        }));
      if (sets.length === 0) return null;

      const previous: PreviousPerformanceDTO = {
        exerciseId,
        sessionId: String(session._id),
        performedAt: (session.endedAt || session.startedAt).toISOString(),
        sets,
      };
      return previous;
    })
  );
  return results.filter((item): item is PreviousPerformanceDTO => item !== null);
}

export async function listSessions(
  userId: string,
  options: { cursor?: string; limit?: number; exerciseId?: string } = {}
): Promise<{ sessions: SessionSummaryDTO[]; nextCursor: string | null }> {
  await getDb();
  await ensureWorkoutsMigrated(userId);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));

  const filter: Record<string, unknown> = { userId, status: "completed" };
  if (options.cursor) filter.endedAt = { $lt: new Date(options.cursor) };
  if (options.exerciseId) filter["exercises.exerciseId"] = options.exerciseId;

  const docs = await WorkoutSession.find(filter)
    .select("routineId name status startedAt endedAt durationSec localDate totals exercises.name exercises.muscleGroup")
    .sort({ endedAt: -1 })
    .limit(limit + 1)
    .lean();

  const page = docs.slice(0, limit);
  const last = page[page.length - 1];
  return {
    sessions: page.map((doc) => toSessionSummaryDTO(doc as IWorkoutSession)),
    nextCursor: docs.length > limit && last?.endedAt ? last.endedAt.toISOString() : null,
  };
}

export interface ExerciseHistoryEntry {
  sessionId: string;
  sessionName: string;
  performedAt: string;
  localDate: string;
  unit: "kg" | "lbs";
  bestE1rmKg: number | null;
  volumeKg: number;
  sets: Array<{
    type: string;
    weightKg: number | null;
    reps: number | null;
    durationSec: number | null;
    distanceM: number | null;
    rpe: number | null;
    prKinds: PrKind[];
  }>;
}

/** Every time the user performed an exercise, newest first. */
export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  limit: number = 30
): Promise<ExerciseHistoryEntry[]> {
  await getDb();
  const sessions = await WorkoutSession.find({
    userId,
    status: "completed",
    "exercises.exerciseId": exerciseId,
  })
    .select("name endedAt startedAt localDate exercises")
    .sort({ endedAt: -1 })
    .limit(Math.min(100, limit))
    .lean();

  return sessions
    .map((session) => {
      const blocks = session.exercises.filter((exercise) => String(exercise.exerciseId) === exerciseId);
      const sets = blocks.flatMap((exercise) =>
        exercise.sets.filter((set) => isSetLogged(set, exercise.trackingType))
      );
      let bestE1rmKg: number | null = null;
      let volumeKg = 0;
      for (const set of sets) {
        if (set.type === "warmup") continue;
        const e1rm = estimateOneRepMaxKg(set.weightKg, set.reps);
        if (e1rm && (!bestE1rmKg || e1rm > bestE1rmKg)) bestE1rmKg = e1rm;
        volumeKg += (set.weightKg ?? 0) * (set.reps ?? 0);
      }
      const entry: ExerciseHistoryEntry = {
        sessionId: String(session._id),
        sessionName: session.name,
        performedAt: (session.endedAt || session.startedAt).toISOString(),
        localDate: session.localDate,
        unit: blocks[0]?.unit === "lbs" ? "lbs" : "kg",
        bestE1rmKg,
        volumeKg: Math.round(volumeKg),
        sets: sets.map((set) => ({
          type: set.type,
          weightKg: set.weightKg ?? null,
          reps: set.reps ?? null,
          durationSec: set.durationSec ?? null,
          distanceM: set.distanceM ?? null,
          rpe: set.rpe ?? null,
          prKinds: set.prKinds || [],
        })),
      };
      return entry;
    })
    .filter((entry) => entry.sets.length > 0);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Starts a new workout: from a routine, as a repeat of a past workout, or
 * empty. A user has at most one workout in progress.
 */
export async function startSession(
  actor: Actor,
  input: { routineId?: string; repeatSessionId?: string; name?: string; startedAt?: string }
): Promise<{ session: SessionDTO; previous: PreviousPerformanceDTO[] }> {
  await getDb();
  await ensureWorkoutsMigrated(actor.userId);

  const active = await WorkoutSession.findOne({ userId: actor.userId, status: "in_progress" })
    .select("_id name")
    .lean();
  if (active) {
    throw conflict("You already have a workout in progress", {
      sessionId: String(active._id),
      sessionName: active.name,
    });
  }

  const now = new Date();
  const startedAt = input.startedAt ? new Date(input.startedAt) : now;
  assertPlausibleStart(startedAt);

  let name = input.name?.trim() || "";
  let routineId: mongoose.Types.ObjectId | null = null;
  let exercises: SessionExerciseData[] = [];

  if (input.routineId) {
    const routine = await Routine.findOne({ _id: input.routineId, userId: actor.userId, archivedAt: null }).lean();
    if (!routine) throw notFound("Routine not found");
    routineId = routine._id;
    name = name || routine.name;
    const snapshots = await loadExerciseSnapshots(
      actor.userId,
      routine.exercises.map((exercise) => String(exercise.exerciseId)),
      { allowArchived: true }
    );
    exercises = buildExercises(
      routine.exercises
        .filter((exercise) => snapshots.has(String(exercise.exerciseId)))
        .map((exercise) => ({
          exerciseId: String(exercise.exerciseId),
          unit: exercise.unit,
          restSec: exercise.restSec ?? null,
          notes: exercise.notes || "",
          supersetGroup: exercise.supersetGroup ?? null,
          sets: exercise.sets.map((set) => ({
            type: set.type,
            weightKg: null,
            reps: null,
            durationSec: null,
            distanceM: null,
            rpe: null,
            done: false,
            doneAt: null,
            targetRepMin: set.repMin ?? null,
            targetRepMax: set.repMax ?? null,
            targetWeightKg: set.targetWeightKg ?? null,
            targetDurationSec: set.targetDurationSec ?? null,
          })),
        })),
      snapshots,
      actor.weightUnit
    );
  } else if (input.repeatSessionId) {
    const source = await findOwned(actor.userId, input.repeatSessionId);
    routineId = source.routineId;
    name = name || source.name;
    const snapshots = await loadExerciseSnapshots(
      actor.userId,
      source.exercises.map((exercise) => String(exercise.exerciseId)),
      { allowArchived: true }
    );
    exercises = buildExercises(
      source.exercises
        .filter((exercise) => snapshots.has(String(exercise.exerciseId)))
        .map((exercise) => ({
          exerciseId: String(exercise.exerciseId),
          unit: exercise.unit,
          restSec: exercise.restSec ?? null,
          notes: exercise.notes || "",
          supersetGroup: exercise.supersetGroup ?? null,
          sets: exercise.sets.map((set) => ({
            type: set.type,
            weightKg: null,
            reps: null,
            durationSec: null,
            distanceM: null,
            rpe: null,
            done: false,
            doneAt: null,
            targetRepMin: set.reps ?? set.targetRepMin ?? null,
            targetRepMax: set.reps ?? set.targetRepMax ?? null,
            targetWeightKg: set.weightKg ?? set.targetWeightKg ?? null,
            targetDurationSec: set.durationSec ?? set.targetDurationSec ?? null,
          })),
        })),
      snapshots,
      actor.weightUnit
    );
  }

  if (!name) name = `${capitalize(localWeekdayKey(startedAt, actor.timezone))} workout`;

  let created;
  try {
    created = await WorkoutSession.create({
      userId: actor.userId,
      routineId,
      name: name.slice(0, 80),
      status: "in_progress",
      startedAt,
      timezone: actor.timezone,
      localDate: localDateString(startedAt, actor.timezone),
      exercises,
      totals: { ...computeTotals(exercises), calories: 0, prCount: 0 },
      version: 0,
      isPastLog: Boolean(input.startedAt),
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      throw conflict("You already have a workout in progress");
    }
    throw err;
  }

  const session = toSessionDTO(created.toObject() as IWorkoutSession);
  const previous = await getPreviousPerformance(
    actor.userId,
    session.exercises.map((exercise) => exercise.exerciseId),
    session.id
  );
  return { session, previous };
}

/**
 * Saves the current state of a workout (autosave while it is in progress, or
 * an edit of a finished one). `version` guards against overwriting a newer
 * copy saved from somewhere else.
 */
export async function saveSession(actor: Actor, sessionId: string, input: SessionSaveInput): Promise<SessionDTO> {
  await getDb();
  const current = await findOwned(actor.userId, sessionId);
  if (current.version !== input.version) {
    throw conflict("This workout was updated on another device", {
      version: current.version,
      status: current.status,
    });
  }

  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.notes !== undefined) set.notes = input.notes;

  let startedAt = current.startedAt;
  if (input.startedAt) {
    startedAt = new Date(input.startedAt);
    assertPlausibleStart(startedAt);
    set.startedAt = startedAt;
    set.localDate = localDateString(startedAt, current.timezone || actor.timezone);
  }

  let exercises: SessionExerciseData[] = current.exercises;
  if (input.exercises) {
    const snapshots = await loadExerciseSnapshots(
      actor.userId,
      input.exercises.map((exercise) => exercise.exerciseId),
      { allowArchived: true }
    );
    exercises = buildExercises(input.exercises, snapshots, actor.weightUnit);
    set.exercises = exercises;
  }

  const completed = current.status === "completed";
  let durationSec = current.durationSec;
  if (completed) {
    if (input.exercises) {
      exercises = loggedOnly(exercises);
      set.exercises = exercises;
    }
    if (input.durationSec !== undefined) durationSec = input.durationSec;
    const loggedSets = computeTotals(exercises).completedSets;
    if (loggedSets === 0) throw badRequest("A finished workout needs at least one logged set");
    durationSec = plausibleDurationSec(durationSec, loggedSets);
    set.durationSec = durationSec;
    set.endedAt = new Date(startedAt.getTime() + durationSec * 1000);
    set.totals = totalsFor(exercises, durationSec, await bodyWeightOf(actor.userId));
  } else {
    set.totals = { ...computeTotals(exercises), calories: 0, prCount: 0 };
  }

  const result = await WorkoutSession.updateOne(
    { _id: sessionId, userId: actor.userId, version: input.version },
    { $set: set, $inc: { version: 1 } },
    { runValidators: true }
  );
  if (result.matchedCount === 0) {
    throw conflict("This workout was updated on another device");
  }

  if (completed) {
    const exerciseIds = [
      ...current.exercises.map((exercise) => String(exercise.exerciseId)),
      ...exercises.map((exercise) => String(exercise.exerciseId)),
    ];
    await recomputeExerciseRecords(actor.userId, exerciseIds);
    await recomputeDays(actor.userId, [current.localDate, set.localDate as string | undefined]);
    await recomputeRoutineStats(actor.userId, [current.routineId]);
  }

  return getSession(actor.userId, sessionId);
}

export interface FinishedRecord {
  exerciseName: string;
  kinds: PrKind[];
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  unit: "kg" | "lbs";
}

/**
 * Finishes a workout. Only what was actually logged is kept; totals,
 * calories, personal records and the day's summary are computed here.
 * Calling it again for an already finished workout returns the same result.
 */
export async function finishSession(
  actor: Actor,
  sessionId: string,
  input: SessionFinishInput
): Promise<{ session: SessionDTO; records: FinishedRecord[] }> {
  await getDb();
  const current = await findOwned(actor.userId, sessionId);

  if (current.status !== "completed") {
    let exercises: SessionExerciseData[] = current.exercises;
    if (input.exercises) {
      const snapshots = await loadExerciseSnapshots(
        actor.userId,
        input.exercises.map((exercise) => exercise.exerciseId),
        { allowArchived: true }
      );
      exercises = buildExercises(input.exercises, snapshots, actor.weightUnit);
    }

    const logged = loggedOnly(exercises);
    if (logged.length === 0) {
      throw badRequest("Log at least one set before finishing, or discard the workout.");
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : current.startedAt;
    if (input.startedAt) assertPlausibleStart(startedAt);
    const loggedSets = logged.reduce((sum, exercise) => sum + exercise.sets.length, 0);

    let durationSec: number;
    if (input.durationSec !== undefined && input.durationSec > 0) {
      durationSec = Math.min(input.durationSec, MAX_SESSION_SECONDS);
    } else {
      const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
      const elapsed = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
      if (elapsed >= 60 && elapsed <= MAX_SESSION_SECONDS) {
        durationSec = elapsed;
      } else {
        // The workout was left open (or the clock is off): use the time of the
        // last logged set, falling back to an estimate from the set count.
        const lastDone = Math.max(
          0,
          ...logged.flatMap((exercise) => exercise.sets.map((set) => set.doneAt?.getTime() || 0))
        );
        const untilLastSet = Math.round((lastDone - startedAt.getTime()) / 1000) + 60;
        durationSec =
          untilLastSet >= 60 && untilLastSet <= MAX_SESSION_SECONDS
            ? untilLastSet
            : plausibleDurationSec(null, loggedSets);
      }
    }

    const timezone = actor.timezone;
    const localDate = localDateString(startedAt, timezone);
    const totals = totalsFor(logged, durationSec, await bodyWeightOf(actor.userId));

    const result = await WorkoutSession.updateOne(
      { _id: sessionId, userId: actor.userId, status: "in_progress" },
      {
        $set: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          exercises: logged,
          status: "completed",
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationSec * 1000),
          durationSec,
          timezone,
          localDate,
          totals,
        },
        $inc: { version: 1 },
      },
      { runValidators: true }
    );

    if (result.matchedCount > 0) {
      await recomputeExerciseRecords(
        actor.userId,
        logged.map((exercise) => String(exercise.exerciseId))
      );
      await recomputeDays(actor.userId, [localDate, current.localDate]);
      // From the workout's own time: a back-dated log is not "done today".
      await recomputeRoutineStats(actor.userId, [current.routineId]);
    }
  }

  const finished = await findOwned(actor.userId, sessionId);
  const records: FinishedRecord[] = [];
  for (const exercise of finished.exercises) {
    for (const set of exercise.sets) {
      if (!set.prKinds || set.prKinds.length === 0) continue;
      records.push({
        exerciseName: exercise.name,
        kinds: set.prKinds,
        weightKg: set.weightKg ?? null,
        reps: set.reps ?? null,
        durationSec: set.durationSec ?? null,
        unit: exercise.unit === "lbs" ? "lbs" : "kg",
      });
    }
  }
  return { session: toSessionDTO(finished), records };
}

/** Throws away a workout in progress. Finished workouts are never touched. */
export async function discardSession(userId: string, sessionId: string): Promise<void> {
  await getDb();
  const result = await WorkoutSession.deleteOne({ _id: sessionId, userId, status: "in_progress" });
  if (result.deletedCount === 0) throw notFound("No workout in progress to discard");
}

/** Deletes a finished workout and rebuilds everything derived from it. */
export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  await getDb();
  const session = await WorkoutSession.findOneAndDelete({ _id: sessionId, userId }).lean();
  if (!session) throw notFound("Workout not found");
  if (session.status === "completed") {
    await recomputeExerciseRecords(
      userId,
      session.exercises.map((exercise) => String(exercise.exerciseId))
    );
    await recomputeDays(userId, [session.localDate]);
    await recomputeRoutineStats(userId, [session.routineId]);
  }
}

// ---------------------------------------------------------------------------
// Overview for the dashboard
// ---------------------------------------------------------------------------

export interface WeekOverview {
  sessions: SessionSummaryDTO[];
  setsByMuscleGroup: Record<string, number>;
  volumeKg: number;
}

/** Calendar days ("YYYY-MM-DD") on which the user finished a workout, within a range. */
export async function listTrainingDates(userId: string, from: string, to: string): Promise<string[]> {
  await getDb();
  const dates = await WorkoutSession.distinct("localDate", {
    userId: new mongoose.Types.ObjectId(userId),
    status: "completed",
    localDate: { $gte: from, $lte: to },
  });
  return dates.map(String);
}

/** Finished workouts and training volume for a set of calendar days. */
export async function getWeekOverview(userId: string, dateStrings: string[]): Promise<WeekOverview> {
  await getDb();
  await ensureWorkoutsMigrated(userId);
  const sessions = await WorkoutSession.find({
    userId,
    status: "completed",
    localDate: { $in: dateStrings },
  })
    .select("routineId name status startedAt endedAt durationSec localDate totals exercises")
    .sort({ endedAt: 1 })
    .lean();

  const setsByMuscleGroup: Record<string, number> = {};
  let volumeKg = 0;
  for (const session of sessions) {
    volumeKg += session.totals?.volumeKg || 0;
    for (const exercise of session.exercises) {
      const logged = exercise.sets.filter(
        (set) => set.type !== "warmup" && isSetLogged(set, exercise.trackingType)
      ).length;
      setsByMuscleGroup[exercise.muscleGroup] = (setsByMuscleGroup[exercise.muscleGroup] || 0) + logged;
    }
  }
  return {
    sessions: sessions.map((session) => toSessionSummaryDTO(session as IWorkoutSession)),
    setsByMuscleGroup,
    volumeKg: Math.round(volumeKg),
  };
}
