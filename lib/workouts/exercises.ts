import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog, { resolveExerciseMeta } from "@/lib/db/models/ExerciseCatalog";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { normalizeExerciseName, type MuscleGroup, type TrackingType } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";

/** Exercises a user may see: the global catalog plus their own custom ones. */
function visibleTo(userId: string) {
  return {
    $or: [{ isCustom: { $ne: true } }, { isCustom: true, createdBy: new mongoose.Types.ObjectId(userId) }],
  };
}

const notArchived = { archivedAt: null };

interface CatalogDoc {
  _id: unknown;
  name: string;
  normalizedName?: string | null;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  muscleGroup?: string | null;
  equipment: string;
  category: string;
  trackingType?: string | null;
  level?: string | null;
  force?: string | null;
  mechanic?: string | null;
  isCustom?: boolean;
  images?: string[];
  instructions?: string[];
  metValue?: number;
}

function cleanList(values: unknown): string[] {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

export function toExerciseDTO(doc: CatalogDoc, detailed: boolean = false): ExerciseDTO {
  const meta = resolveExerciseMeta(doc);
  const images = cleanList(doc.images);
  const dto: ExerciseDTO = {
    id: String(doc._id),
    name: doc.name,
    primaryMuscle: doc.primaryMuscle,
    secondaryMuscles: cleanList(doc.secondaryMuscles),
    muscleGroup: meta.muscleGroup,
    equipment: doc.equipment || "other",
    category: doc.category || "strength",
    trackingType: meta.trackingType,
    level: doc.level || null,
    force: doc.force || null,
    mechanic: doc.mechanic || null,
    isCustom: Boolean(doc.isCustom),
    image: images[0] || null,
  };
  if (detailed) {
    dto.images = images;
    dto.instructions = cleanList(doc.instructions);
  }
  return dto;
}

/**
 * The whole catalog in a light form (no instructions). It is small enough to
 * send once, which lets the picker search instantly and keep working with a
 * weak gym connection.
 */
export async function listExerciseCatalog(userId: string): Promise<ExerciseDTO[]> {
  await getDb();
  const docs = await ExerciseCatalog.find({ ...visibleTo(userId), ...notArchived })
    .select("name normalizedName primaryMuscle secondaryMuscles muscleGroup equipment category trackingType level force mechanic isCustom images")
    .slice("images", 1)
    .sort({ name: 1 })
    .lean();
  return docs.map((doc) => toExerciseDTO(doc as unknown as CatalogDoc));
}

/** Full details (instructions, all images) of one visible exercise. */
export async function getExercise(userId: string, exerciseId: string): Promise<ExerciseDTO> {
  await getDb();
  const doc = await ExerciseCatalog.findOne({ _id: exerciseId, ...visibleTo(userId) }).lean();
  if (!doc) throw notFound("Exercise not found");
  return toExerciseDTO(doc as unknown as CatalogDoc, true);
}

export interface ExerciseSnapshot {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  trackingType: TrackingType;
  metValue: number;
}

/**
 * Trusted copies of the catalog fields that get stored inside routines and
 * sessions. The browser only ever sends exercise ids.
 */
export async function loadExerciseSnapshots(
  userId: string,
  exerciseIds: string[],
  options: { allowArchived?: boolean } = {}
): Promise<Map<string, ExerciseSnapshot>> {
  const unique = Array.from(new Set(exerciseIds));
  const snapshots = new Map<string, ExerciseSnapshot>();
  if (unique.length === 0) return snapshots;

  await getDb();
  const docs = await ExerciseCatalog.find({
    _id: { $in: unique },
    ...visibleTo(userId),
    ...(options.allowArchived ? {} : notArchived),
  })
    .select("name normalizedName primaryMuscle muscleGroup equipment category trackingType metValue")
    .lean();

  for (const doc of docs) {
    const meta = resolveExerciseMeta(doc);
    snapshots.set(String(doc._id), {
      exerciseId: String(doc._id),
      name: doc.name,
      primaryMuscle: doc.primaryMuscle,
      muscleGroup: meta.muscleGroup,
      trackingType: meta.trackingType,
      metValue: typeof doc.metValue === "number" && doc.metValue >= 1 ? doc.metValue : 5,
    });
  }
  return snapshots;
}

function slugify(name: string): string {
  const base = normalizeExerciseName(name).replace(/\s+/g, "-") || "exercise";
  return `${base}-${new mongoose.Types.ObjectId().toString().slice(-8)}`;
}

interface CustomExerciseInput {
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string;
  category?: string;
  trackingType?: TrackingType;
  instructions?: string[];
}

async function assertNameIsFree(userId: string, name: string, ignoreId?: string): Promise<void> {
  const normalized = normalizeExerciseName(name);
  if (!normalized) throw badRequest("Enter a name for the exercise");
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clash = await ExerciseCatalog.findOne({
    ...visibleTo(userId),
    ...notArchived,
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    $and: [{ $or: [{ normalizedName: normalized }, { name: new RegExp(`^${escaped}$`, "i") }] }],
  })
    .select("_id name")
    .lean();
  if (clash) {
    throw conflict(`"${clash.name}" already exists in the exercise list`, { exerciseId: String(clash._id) });
  }
}

export async function createCustomExercise(userId: string, input: CustomExerciseInput): Promise<ExerciseDTO> {
  await getDb();
  await assertNameIsFree(userId, input.name);

  const doc = await ExerciseCatalog.create({
    name: input.name,
    slug: slugify(input.name),
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles: (input.secondaryMuscles || []).filter((muscle) => muscle !== input.primaryMuscle),
    equipment: input.equipment,
    category: input.category || "strength",
    ...(input.trackingType ? { trackingType: input.trackingType } : {}),
    instructions: input.instructions || [],
    isCustom: true,
    createdBy: userId,
  });
  return toExerciseDTO(doc.toObject() as unknown as CatalogDoc, true);
}

export async function updateCustomExercise(
  userId: string,
  exerciseId: string,
  patch: Partial<CustomExerciseInput>
): Promise<ExerciseDTO> {
  await getDb();
  const doc = await ExerciseCatalog.findOne({ _id: exerciseId, isCustom: true, createdBy: userId, ...notArchived });
  if (!doc) throw notFound("Custom exercise not found");

  if (patch.name && patch.name !== doc.name) {
    await assertNameIsFree(userId, patch.name, exerciseId);
    doc.name = patch.name;
  }
  if (patch.primaryMuscle) doc.primaryMuscle = patch.primaryMuscle;
  if (patch.secondaryMuscles) {
    doc.secondaryMuscles = patch.secondaryMuscles.filter((muscle) => muscle !== doc.primaryMuscle);
  }
  if (patch.equipment) doc.equipment = patch.equipment;
  if (patch.category) doc.category = patch.category;
  if (patch.trackingType) doc.trackingType = patch.trackingType;
  if (patch.instructions) doc.instructions = patch.instructions;

  await doc.save();
  return toExerciseDTO(doc.toObject() as unknown as CatalogDoc, true);
}

/** Archives a custom exercise. History that used it keeps working. */
export async function archiveCustomExercise(userId: string, exerciseId: string): Promise<void> {
  await getDb();
  const result = await ExerciseCatalog.updateOne(
    { _id: exerciseId, isCustom: true, createdBy: userId, ...notArchived },
    { $set: { archivedAt: new Date() } }
  );
  if (result.matchedCount === 0) throw notFound("Custom exercise not found");
}
