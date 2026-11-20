import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import PersonalRecord from "@/lib/db/models/PersonalRecord";
import { walkExerciseRecords, type RecordWalkSession } from "@/lib/workouts/calc";
import type { PersonalRecordDTO, PrKind } from "@/lib/workouts/types";

/**
 * Rebuilds personal records for the given exercises from the user's whole
 * history: which sets were PRs when they happened, and what the current
 * bests are. Called after a session is finished, edited or deleted, so the
 * records always match the history.
 */
export async function recomputeExerciseRecords(userId: string, exerciseIds: string[]): Promise<void> {
  const unique = Array.from(new Set(exerciseIds.filter(Boolean)));
  if (unique.length === 0) return;

  await getDb();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const exerciseObjectIds = unique.map((id) => new mongoose.Types.ObjectId(id));

  const sessions = await WorkoutSession.find({
    userId: userObjectId,
    status: "completed",
    "exercises.exerciseId": { $in: exerciseObjectIds },
  })
    .select("endedAt startedAt exercises totals")
    .sort({ endedAt: 1, _id: 1 })
    .lean();

  const wanted = new Set(unique);
  const prKindsBySetId = new Map<string, PrKind[]>();
  const recordOps: Parameters<typeof PersonalRecord.bulkWrite>[0] = [];

  for (const exerciseId of unique) {
    const walk: RecordWalkSession[] = [];
    let exerciseName = "";
    for (const session of sessions) {
      for (const exercise of session.exercises) {
        if (String(exercise.exerciseId) !== exerciseId) continue;
        exerciseName = exercise.name;
        walk.push({
          sessionId: String(session._id),
          endedAt: session.endedAt || session.startedAt,
          trackingType: exercise.trackingType,
          sets: exercise.sets.map((set) => ({
            id: String(set._id),
            type: set.type,
            weightKg: set.weightKg,
            reps: set.reps,
            durationSec: set.durationSec,
            distanceM: set.distanceM,
            done: set.done,
          })),
        });
      }
    }

    const result = walkExerciseRecords(walk);
    for (const [setId, kinds] of result.prKindsBySetId) prKindsBySetId.set(setId, kinds);

    const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);
    const kindsPresent = result.bests.map((best) => best.kind);
    recordOps.push({
      deleteMany: {
        filter: { userId: userObjectId, exerciseId: exerciseObjectId, kind: { $nin: kindsPresent } },
      },
    });
    for (const best of result.bests) {
      recordOps.push({
        updateOne: {
          filter: { userId: userObjectId, exerciseId: exerciseObjectId, kind: best.kind },
          update: {
            $set: {
              exerciseName,
              value: best.value,
              weightKg: best.weightKg,
              reps: best.reps,
              sessionId: new mongoose.Types.ObjectId(best.sessionId),
              achievedAt: best.achievedAt,
            },
          },
          upsert: true,
        },
      });
    }
  }

  // Write the per-set PR flags back, touching only sessions that changed.
  const sessionOps: Parameters<typeof WorkoutSession.bulkWrite>[0] = [];
  for (const session of sessions) {
    let changed = false;
    let prCount = 0;
    const exercises = session.exercises.map((exercise) => {
      const recompute = wanted.has(String(exercise.exerciseId));
      const sets = exercise.sets.map((set) => {
        const next = recompute ? prKindsBySetId.get(String(set._id)) || [] : set.prKinds || [];
        const current = set.prKinds || [];
        if (recompute && (next.length !== current.length || next.some((kind, index) => kind !== current[index]))) {
          changed = true;
        }
        if (next.length > 0) prCount += 1;
        return { ...set, prKinds: next };
      });
      return { ...exercise, sets };
    });
    if (changed || (session.totals?.prCount || 0) !== prCount) {
      sessionOps.push({
        updateOne: {
          filter: { _id: session._id },
          update: { $set: { exercises, "totals.prCount": prCount } },
        },
      });
    }
  }

  if (recordOps.length > 0) await PersonalRecord.bulkWrite(recordOps, { ordered: false });
  if (sessionOps.length > 0) await WorkoutSession.bulkWrite(sessionOps, { ordered: false });
}

/** The user's current bests, newest first (for the dashboard and the records page). */
export async function listPersonalRecords(
  userId: string,
  options: { limit?: number; exerciseId?: string } = {}
): Promise<PersonalRecordDTO[]> {
  await getDb();
  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (options.exerciseId) filter.exerciseId = new mongoose.Types.ObjectId(options.exerciseId);
  const docs = await PersonalRecord.find(filter)
    .sort({ achievedAt: -1 })
    .limit(options.limit ?? 50)
    .lean();
  return docs.map((doc) => ({
    exerciseId: String(doc.exerciseId),
    exerciseName: doc.exerciseName,
    kind: doc.kind,
    value: doc.value,
    weightKg: doc.weightKg ?? null,
    reps: doc.reps ?? null,
    sessionId: String(doc.sessionId),
    achievedAt: doc.achievedAt.toISOString(),
  }));
}

export interface RecentPrSet {
  sessionId: string;
  sessionName: string;
  achievedAt: string;
  exerciseId: string;
  exerciseName: string;
  unit: "kg" | "lbs";
  kinds: PrKind[];
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
}

/** Sets that were PRs in the user's most recent sessions (dashboard widget). */
export async function listRecentPrSets(userId: string, limit: number = 5): Promise<RecentPrSet[]> {
  await getDb();
  const sessions = await WorkoutSession.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: "completed",
    "totals.prCount": { $gt: 0 },
  })
    .select("name endedAt startedAt exercises")
    .sort({ endedAt: -1 })
    .limit(10)
    .lean();

  const result: RecentPrSet[] = [];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!set.prKinds || set.prKinds.length === 0) continue;
        result.push({
          sessionId: String(session._id),
          sessionName: session.name,
          achievedAt: (session.endedAt || session.startedAt).toISOString(),
          exerciseId: String(exercise.exerciseId),
          exerciseName: exercise.name,
          unit: exercise.unit === "lbs" ? "lbs" : "kg",
          kinds: set.prKinds,
          weightKg: set.weightKg ?? null,
          reps: set.reps ?? null,
          durationSec: set.durationSec ?? null,
        });
        if (result.length >= limit) return result;
      }
    }
  }
  return result;
}
