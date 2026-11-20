import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import Routine, { type IRoutine, type IRoutineExercise } from "@/lib/db/models/Routine";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import User from "@/lib/db/models/User";
import { badRequest, notFound } from "@/lib/api/errors";
import { loadExerciseSnapshots, type ExerciseSnapshot } from "@/lib/workouts/exercises";
import { toRoutineDTO, toRoutineSummaryDTO } from "@/lib/workouts/mappers";
import { findTemplate } from "@/lib/workouts/templates";
import { isSetLogged } from "@/lib/workouts/calc";
import type { RoutineDTO, RoutineSummaryDTO } from "@/lib/workouts/types";
import type { RoutineExerciseInput } from "@/lib/validation/workouts";
import type { WeightUnit } from "@/lib/fitness/units";

type RoutineExerciseData = Omit<IRoutineExercise, "_id"> & { _id?: mongoose.Types.ObjectId };

function buildExercises(
  inputs: RoutineExerciseInput[],
  snapshots: Map<string, ExerciseSnapshot>,
  defaultUnit: WeightUnit
): RoutineExerciseData[] {
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
      sets: input.sets.map((set) => {
        const repMin = set.repMin ?? set.repMax ?? null;
        const repMax = set.repMax ?? set.repMin ?? null;
        return {
          type: set.type,
          repMin: repMin != null && repMax != null ? Math.min(repMin, repMax) : repMin,
          repMax: repMin != null && repMax != null ? Math.max(repMin, repMax) : repMax,
          targetWeightKg: set.targetWeightKg ?? null,
          targetDurationSec: set.targetDurationSec ?? null,
          targetRpe: set.targetRpe ?? null,
        };
      }),
    };
  });
}

export async function listRoutines(userId: string): Promise<RoutineSummaryDTO[]> {
  await getDb();
  const routines = await Routine.find({ userId, archivedAt: null }).sort({ updatedAt: -1 }).limit(200).lean();
  return routines.map((routine) => toRoutineSummaryDTO(routine as IRoutine));
}

export async function getRoutine(userId: string, routineId: string): Promise<RoutineDTO> {
  await getDb();
  const routine = await Routine.findOne({ _id: routineId, userId, archivedAt: null }).lean();
  if (!routine) throw notFound("Routine not found");
  return toRoutineDTO(routine as IRoutine);
}

/** Exercises of a built-in template, resolved against the catalog by name. */
async function exercisesFromTemplate(userId: string, templateId: string, unit: WeightUnit) {
  const template = findTemplate(templateId);
  if (!template) throw notFound("Template not found");

  const candidateNames = template.exercises.flatMap((exercise) => exercise.names);
  const docs = await ExerciseCatalog.find({
    name: { $in: candidateNames },
    isCustom: { $ne: true },
    archivedAt: null,
  })
    .select("_id name")
    .lean();
  const idByName = new Map(docs.map((doc) => [doc.name.toLowerCase(), String(doc._id)]));

  const inputs: RoutineExerciseInput[] = [];
  const skipped: string[] = [];
  for (const exercise of template.exercises) {
    const match = exercise.names.map((name) => idByName.get(name.toLowerCase())).find(Boolean);
    if (!match) {
      skipped.push(exercise.names[0]);
      continue;
    }
    inputs.push({
      exerciseId: match,
      unit,
      restSec: exercise.restSec,
      notes: "",
      supersetGroup: null,
      sets: Array.from({ length: exercise.sets }, () => ({
        type: exercise.setType || "working",
        repMin: exercise.repMin,
        repMax: exercise.repMax,
        targetWeightKg: null,
        targetDurationSec: exercise.durationSec ?? null,
        targetRpe: null,
      })),
    });
  }
  if (inputs.length === 0) throw badRequest("None of this template's exercises are in the exercise list");
  return { inputs, skipped, template };
}

/** Exercises of a finished session, turned into targets ("save as routine"). */
async function exercisesFromSession(userId: string, sessionId: string): Promise<RoutineExerciseInput[]> {
  const session = await WorkoutSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw notFound("Workout not found");
  return session.exercises.map((exercise) => {
    const logged = exercise.sets.filter((set) => isSetLogged(set, exercise.trackingType));
    const source = logged.length > 0 ? logged : exercise.sets;
    return {
      exerciseId: String(exercise.exerciseId),
      unit: exercise.unit,
      restSec: exercise.restSec ?? null,
      notes: exercise.notes || "",
      supersetGroup: exercise.supersetGroup ?? null,
      sets: source.map((set) => ({
        type: set.type,
        repMin: set.reps ?? set.targetRepMin ?? null,
        repMax: set.reps ?? set.targetRepMax ?? null,
        targetWeightKg: set.weightKg ?? set.targetWeightKg ?? null,
        targetDurationSec: set.durationSec ?? set.targetDurationSec ?? null,
        targetRpe: null,
      })),
    };
  });
}

export async function createRoutine(
  userId: string,
  input: {
    name: string;
    notes?: string;
    exercises?: RoutineExerciseInput[];
    templateId?: string;
    fromSessionId?: string;
  },
  defaultUnit: WeightUnit
): Promise<{ routine: RoutineDTO; skipped: string[] }> {
  await getDb();

  let inputs = input.exercises || [];
  let skipped: string[] = [];
  if (input.templateId) {
    const fromTemplate = await exercisesFromTemplate(userId, input.templateId, defaultUnit);
    inputs = fromTemplate.inputs;
    skipped = fromTemplate.skipped;
  } else if (input.fromSessionId) {
    inputs = await exercisesFromSession(userId, input.fromSessionId);
  }

  const snapshots = await loadExerciseSnapshots(
    userId,
    inputs.map((exercise) => exercise.exerciseId)
  );
  // Exercises archived since a session was logged are dropped, not fatal.
  const usable = inputs.filter((exercise) => snapshots.has(exercise.exerciseId));

  const routine = await Routine.create({
    userId,
    name: input.name,
    notes: input.notes || "",
    exercises: buildExercises(usable, snapshots, defaultUnit),
  });
  return { routine: toRoutineDTO(routine.toObject() as IRoutine), skipped };
}

export async function updateRoutine(
  userId: string,
  routineId: string,
  patch: { name?: string; notes?: string; exercises?: RoutineExerciseInput[] },
  defaultUnit: WeightUnit
): Promise<RoutineDTO> {
  await getDb();
  const routine = await Routine.findOne({ _id: routineId, userId, archivedAt: null });
  if (!routine) throw notFound("Routine not found");

  if (patch.name !== undefined) routine.name = patch.name;
  if (patch.notes !== undefined) routine.notes = patch.notes;
  if (patch.exercises) {
    // Exercises already in the routine stay valid even if archived later.
    const snapshots = await loadExerciseSnapshots(
      userId,
      patch.exercises.map((exercise) => exercise.exerciseId),
      { allowArchived: true }
    );
    routine.set("exercises", buildExercises(patch.exercises, snapshots, defaultUnit));
  }
  await routine.save();
  return toRoutineDTO(routine.toObject() as IRoutine);
}

export async function duplicateRoutine(userId: string, routineId: string): Promise<RoutineDTO> {
  await getDb();
  const source = await Routine.findOne({ _id: routineId, userId, archivedAt: null }).lean();
  if (!source) throw notFound("Routine not found");
  const copy = await Routine.create({
    userId,
    name: `${source.name} (copy)`.slice(0, 80),
    notes: source.notes,
    // New ids are generated for the copy's exercises.
    exercises: source.exercises.map((exercise) => ({ ...exercise, _id: undefined })),
  });
  return toRoutineDTO(copy.toObject() as IRoutine);
}

/** Archives a routine (history keeps its sessions) and frees its schedule days. */
export async function archiveRoutine(userId: string, routineId: string): Promise<void> {
  await getDb();
  const result = await Routine.updateOne(
    { _id: routineId, userId, archivedAt: null },
    { $set: { archivedAt: new Date() } }
  );
  if (result.matchedCount === 0) throw notFound("Routine not found");
  await User.updateOne(
    { _id: userId },
    { $set: { "weeklyRoutine.$[day].routineId": null } },
    { arrayFilters: [{ "day.routineId": new mongoose.Types.ObjectId(routineId) }] }
  );
}

/**
 * "Use today's numbers as the targets for next time."
 *
 * Only numbers change: for every exercise of the routine that was performed
 * in the session, each planned set takes the weight (and hold time) of the
 * matching logged set. The routine keeps its exercises, their order, the
 * number of sets and the rep ranges, so finishing a short or partial workout
 * can never shrink the plan. A rep range is only filled in where the plan
 * had none.
 */
export async function applySessionToRoutine(userId: string, routineId: string, sessionId: string): Promise<RoutineDTO> {
  await getDb();
  const routine = await Routine.findOne({ _id: routineId, userId, archivedAt: null });
  if (!routine) throw notFound("Routine not found");
  const session = await WorkoutSession.findOne({ _id: sessionId, userId, status: "completed" }).lean();
  if (!session) throw notFound("Workout not found");

  // The same exercise can appear twice in a workout: match them in order.
  const performed = new Map<string, Array<(typeof session.exercises)[number]>>();
  for (const exercise of session.exercises) {
    const key = String(exercise.exerciseId);
    performed.set(key, [...(performed.get(key) || []), exercise]);
  }

  for (const planned of routine.exercises) {
    const done = performed.get(String(planned.exerciseId))?.shift();
    if (!done) continue;
    const logged = done.sets.filter((set) => isSetLogged(set, done.trackingType));
    if (logged.length === 0) continue;

    // Warm-ups are matched with warm-ups, the other sets with each other.
    const warmups = logged.filter((set) => set.type === "warmup");
    const others = logged.filter((set) => set.type !== "warmup");
    let warmupIndex = 0;
    let otherIndex = 0;

    for (const target of planned.sets) {
      const source = target.type === "warmup" ? warmups[warmupIndex++] : others[otherIndex++];
      if (!source) continue;
      if (source.weightKg != null) target.targetWeightKg = source.weightKg;
      if (source.durationSec != null && done.trackingType !== "weight_reps" && done.trackingType !== "bodyweight_reps") {
        target.targetDurationSec = source.durationSec;
      }
      if (target.repMin == null && target.repMax == null && source.reps != null) {
        target.repMin = source.reps;
        target.repMax = source.reps;
      }
    }
    planned.unit = done.unit === "lbs" ? "lbs" : "kg";
  }

  routine.markModified("exercises");
  await routine.save();
  return toRoutineDTO(routine.toObject() as IRoutine);
}
