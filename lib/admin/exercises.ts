import "server-only";
import mongoose, { type PipelineStage } from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import Routine from "@/lib/db/models/Routine";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import LegacyWorkout from "@/lib/db/models/Workout";
import LegacyWorkoutTemplate from "@/lib/db/models/WorkoutTemplate";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import {
  MUSCLES_BY_GROUP,
  TRACKING_TYPES,
  muscleGroupOf,
  normalizeExerciseName,
  searchTokens,
  trackingTypeOf,
  type MuscleGroup,
  type TrackingType,
} from "@/lib/workouts/taxonomy";
import { escapeRegex, type ExerciseInput, type ExerciseListQuery } from "@/lib/validation/admin";
import {
  destroyUnusedExerciseImages,
  exerciseImageUrlProblem,
  markExerciseImagesSaved,
} from "@/lib/admin/exercise-images";

/** Exercise catalog management for the admin panel. */

export interface AdminExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  category: string;
  trackingType: TrackingType;
  level: string | null;
  metValue: number;
  isCustom: boolean;
  archivedAt: string | null;
  imageCount: number;
  instructionCount: number;
  cover: string | null;
  createdAt: string | null;
}

export interface AdminExerciseDTO {
  id: string;
  name: string;
  slug: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  /** The stored or derived tracking type. */
  trackingType: TrackingType;
  /** What the form selector shows: "auto" when it simply follows the derivation. */
  trackingTypeChoice: TrackingType | "auto";
  force: string | null;
  level: string | null;
  mechanic: string | null;
  metValue: number;
  instructions: string[];
  images: string[];
  isCustom: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string;
}

export interface ExerciseUsage {
  routines: number;
  sessions: number;
  legacyWorkouts: number;
  legacyTemplates: number;
}

interface CatalogLean {
  _id: unknown;
  name: string;
  normalizedName?: string | null;
  slug?: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  muscleGroup?: string | null;
  equipment?: string;
  category?: string;
  trackingType?: string | null;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  metValue?: number;
  instructions?: string[];
  images?: string[];
  isCustom?: boolean;
  createdBy?: unknown;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

function isTrackingType(value: unknown): value is TrackingType {
  return (TRACKING_TYPES as readonly string[]).includes(String(value));
}

function resolveTracking(doc: CatalogLean): { trackingType: TrackingType; choice: TrackingType | "auto" } {
  const derived = trackingTypeOf(doc);
  if (doc.normalizedName && isTrackingType(doc.trackingType)) {
    return { trackingType: doc.trackingType, choice: doc.trackingType === derived ? "auto" : doc.trackingType };
  }
  return { trackingType: derived, choice: "auto" };
}

export function toAdminExerciseDTO(doc: CatalogLean): AdminExerciseDTO {
  const tracking = resolveTracking(doc);
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug || "",
    primaryMuscle: doc.primaryMuscle,
    secondaryMuscles: strings(doc.secondaryMuscles),
    equipment: doc.equipment || "other",
    category: doc.category || "strength",
    trackingType: tracking.trackingType,
    trackingTypeChoice: tracking.choice,
    force: doc.force || null,
    level: doc.level || null,
    mechanic: doc.mechanic || null,
    metValue: typeof doc.metValue === "number" ? doc.metValue : 5,
    instructions: strings(doc.instructions),
    images: strings(doc.images),
    isCustom: Boolean(doc.isCustom),
    archivedAt: iso(doc.archivedAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt) || new Date(0).toISOString(),
  };
}

// ── Derived fields for records saved before they existed ──────────────────

let backfillDone = false;

/**
 * Fills normalizedName / muscleGroup / trackingType on catalog records saved
 * before those fields existed, so filters and duplicate checks see them.
 * Runs once per server instance, in batches.
 */
export async function backfillDerivedExerciseFields(): Promise<number> {
  if (backfillDone) return 0;
  await getDb();
  let updated = 0;
  for (let round = 0; round < 20; round++) {
    const docs = (await ExerciseCatalog.find({ $or: [{ normalizedName: { $exists: false } }, { normalizedName: "" }] })
      .select("name primaryMuscle equipment category trackingType")
      .limit(500)
      .lean()) as CatalogLean[];
    const operations = docs
      .map((doc) => ({
        doc,
        normalizedName: normalizeExerciseName(doc.name || ""),
      }))
      // Names without Latin letters or digits cannot be normalized; leave them.
      .filter(({ normalizedName }) => normalizedName)
      .map(({ doc, normalizedName }) => ({
        updateOne: {
          filter: { _id: doc._id as mongoose.Types.ObjectId },
          update: {
            $set: {
              normalizedName,
              muscleGroup: muscleGroupOf(doc.primaryMuscle, doc.category),
              trackingType: isTrackingType(doc.trackingType) ? doc.trackingType : trackingTypeOf(doc),
            },
          },
          // Leave updatedAt alone: this is not an edit.
          timestamps: false,
        },
      }));
    if (operations.length) {
      const result = await ExerciseCatalog.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount;
    }
    if (docs.length < 500 || operations.length === 0) break;
  }
  backfillDone = true;
  return updated;
}

// ── Listing ─────────────────────────────────────────────────────────────────

const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;
const exact = (value: string) => new RegExp(`^${escapeRegex(value)}$`, "i");

function groupFilter(group: MuscleGroup): Record<string, unknown> {
  if (group === "cardio") return { category: exact("cardio") };
  if (group === "other") return { muscleGroup: "other" };
  return {
    category: { $not: exact("cardio") },
    primaryMuscle: { $in: MUSCLES_BY_GROUP[group].map(exact) },
  };
}

export function buildExerciseFilter(query: ExerciseListQuery): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (query.status === "active") and.push({ archivedAt: null });
  else if (query.status === "archived") and.push({ archivedAt: { $ne: null } });

  if (query.type === "custom") and.push({ isCustom: true });
  else if (query.type === "global") and.push({ isCustom: { $ne: true } });

  if (query.muscle) and.push({ primaryMuscle: exact(query.muscle) });
  else if (query.muscleGroup) and.push(groupFilter(query.muscleGroup));

  if (query.equipment) and.push({ equipment: exact(query.equipment) });
  if (query.category) and.push({ category: exact(query.category) });
  if (query.trackingType) and.push({ trackingType: query.trackingType });

  const noImages = { $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] };
  const noSteps = { $or: [{ instructions: { $exists: false } }, { instructions: { $size: 0 } }] };
  if (query.completeness === "missing_images") and.push(noImages);
  else if (query.completeness === "missing_instructions") and.push(noSteps);
  else if (query.completeness === "incomplete") and.push({ $or: [...noImages.$or, ...noSteps.$or] });

  // Every word must match the name, muscle, equipment or category (substring, any case).
  for (const token of searchTokens(query.search)) {
    const pattern = new RegExp(escapeRegex(token), "i");
    and.push({
      $or: [
        { normalizedName: pattern },
        { name: pattern },
        { primaryMuscle: pattern },
        { equipment: pattern },
        { category: pattern },
      ],
    });
  }

  return and.length ? { $and: and } : {};
}

export async function listAdminExercises(query: ExerciseListQuery) {
  await getDb();
  await backfillDerivedExerciseFields();

  const filter = buildExerciseFilter(query);
  const direction = query.sortDir === "desc" ? -1 : 1;
  const pipeline: PipelineStage[] = [
    { $match: filter },
    { $sort: { [query.sortField]: direction, _id: 1 } },
    { $skip: (query.page - 1) * query.limit },
    { $limit: query.limit },
    {
      $project: {
        name: 1,
        normalizedName: 1,
        primaryMuscle: 1,
        muscleGroup: 1,
        equipment: 1,
        category: 1,
        trackingType: 1,
        level: 1,
        metValue: 1,
        isCustom: 1,
        archivedAt: 1,
        createdAt: 1,
        imageCount: { $size: { $ifNull: ["$images", []] } },
        instructionCount: { $size: { $ifNull: ["$instructions", []] } },
        cover: { $arrayElemAt: [{ $ifNull: ["$images", []] }, 0] },
      },
    },
  ];

  const [docs, total] = await Promise.all([
    ExerciseCatalog.aggregate(pipeline).collation(CASE_INSENSITIVE),
    ExerciseCatalog.countDocuments(filter),
  ]);

  const exercises: AdminExerciseRow[] = (docs as Array<CatalogLean & { imageCount: number; instructionCount: number; cover?: string }>).map(
    (doc) => ({
      id: String(doc._id),
      name: doc.name,
      primaryMuscle: doc.primaryMuscle,
      muscleGroup: muscleGroupOf(doc.primaryMuscle, doc.category),
      equipment: doc.equipment || "other",
      category: doc.category || "strength",
      trackingType: resolveTracking(doc).trackingType,
      level: doc.level || null,
      metValue: typeof doc.metValue === "number" ? doc.metValue : 5,
      isCustom: Boolean(doc.isCustom),
      archivedAt: iso(doc.archivedAt),
      imageCount: doc.imageCount,
      instructionCount: doc.instructionCount,
      cover: typeof doc.cover === "string" ? doc.cover : null,
      createdAt: iso(doc.createdAt),
    })
  );

  return {
    exercises,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

// ── Reading one ─────────────────────────────────────────────────────────────

function assertId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid exercise id");
  return new mongoose.Types.ObjectId(id);
}

export async function getAdminExercise(id: string): Promise<AdminExerciseDTO> {
  assertId(id);
  await getDb();
  const doc = (await ExerciseCatalog.findById(id).lean()) as CatalogLean | null;
  if (!doc) throw notFound("Exercise not found");
  return toAdminExerciseDTO(doc);
}

/** How much user data points at an exercise (shown before archiving). */
export async function getExerciseUsage(id: string): Promise<ExerciseUsage> {
  const exerciseId = assertId(id);
  await getDb();
  const [routines, sessions, legacyWorkouts, legacyTemplates] = await Promise.all([
    Routine.countDocuments({ "exercises.exerciseId": exerciseId, archivedAt: null }),
    WorkoutSession.countDocuments({ "exercises.exerciseId": exerciseId }),
    LegacyWorkout.countDocuments({ "exercises.catalogId": exerciseId }),
    LegacyWorkoutTemplate.countDocuments({ "exercises.catalogId": exerciseId }),
  ]);
  return { routines, sessions, legacyWorkouts, legacyTemplates };
}

// ── Duplicate names ─────────────────────────────────────────────────────────

interface NameScope {
  ignoreId?: string;
  /** For a user's custom exercise: also clash with that user's other custom exercises. */
  ownerId?: string | null;
  /** Only look at exercises that are not archived. */
  activeOnly?: boolean;
}

export interface NameClash {
  exerciseId: string;
  name: string;
  archived: boolean;
}

/** An exercise whose name equals `name` ignoring case and punctuation, or null. */
export async function findExerciseNameClash(name: string, scope: NameScope = {}): Promise<NameClash | null> {
  const normalized = normalizeExerciseName(name);
  if (!normalized) return null;
  await getDb();

  const owners: Record<string, unknown>[] = [{ isCustom: { $ne: true } }];
  if (scope.ownerId) owners.push({ isCustom: true, createdBy: new mongoose.Types.ObjectId(scope.ownerId) });

  const clash = (await ExerciseCatalog.findOne({
    $and: [
      { $or: owners },
      { $or: [{ normalizedName: normalized }, { name: exact(name.trim()) }] },
      ...(scope.ignoreId ? [{ _id: { $ne: new mongoose.Types.ObjectId(scope.ignoreId) } }] : []),
      ...(scope.activeOnly ? [{ archivedAt: null }] : []),
    ],
  })
    .sort({ archivedAt: 1, createdAt: 1 })
    .select("_id name archivedAt")
    .lean()) as CatalogLean | null;

  return clash ? { exerciseId: String(clash._id), name: clash.name, archived: Boolean(clash.archivedAt) } : null;
}

function clashError(clash: NameClash) {
  const message = clash.archived
    ? `An archived exercise called "${clash.name}" already exists. Restore it instead of creating a copy.`
    : `"${clash.name}" already exists in the catalog.`;
  return conflict(message, { exerciseId: clash.exerciseId, archived: clash.archived });
}

// ── Writing ─────────────────────────────────────────────────────────────────

function assertImagesServable(images: readonly string[]): void {
  images.forEach((url, index) => {
    const problem = exerciseImageUrlProblem(url);
    if (problem) throw badRequest(`Image ${index + 1} ${problem}.`);
  });
}

function slugFor(name: string): string {
  const base = normalizeExerciseName(name).replace(/\s+/g, "-").slice(0, 80) || "exercise";
  return `${base}-${new mongoose.Types.ObjectId().toString().slice(-8)}`;
}

function persistedFields(input: ExerciseInput) {
  const trackingType: TrackingType =
    input.trackingType === "auto" ? trackingTypeOf(input) : input.trackingType;
  return {
    name: input.name,
    normalizedName: normalizeExerciseName(input.name),
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles: input.secondaryMuscles,
    muscleGroup: muscleGroupOf(input.primaryMuscle, input.category),
    equipment: input.equipment,
    category: input.category,
    trackingType,
    force: input.force,
    level: input.level,
    mechanic: input.mechanic,
    metValue: input.metValue,
    instructions: input.instructions,
    images: input.images,
  };
}

export async function createAdminExercise(adminId: string, input: ExerciseInput): Promise<AdminExerciseDTO> {
  assertImagesServable(input.images);
  await getDb();
  await backfillDerivedExerciseFields();

  const clash = await findExerciseNameClash(input.name);
  if (clash) throw clashError(clash);

  const doc = await ExerciseCatalog.create({
    ...persistedFields(input),
    slug: slugFor(input.name),
    isCustom: false,
    createdBy: new mongoose.Types.ObjectId(adminId),
    archivedAt: null,
  });

  // Two simultaneous creates can both pass the check above; keep the oldest.
  const twin = await findExerciseNameClash(input.name, { ignoreId: String(doc._id) });
  if (twin) {
    const twinDoc = await ExerciseCatalog.findById(twin.exerciseId).select("createdAt _id").lean();
    const twinIsOlder =
      twinDoc &&
      (twinDoc.createdAt.getTime() < doc.createdAt.getTime() ||
        (twinDoc.createdAt.getTime() === doc.createdAt.getTime() && String(twinDoc._id) < String(doc._id)));
    if (twinIsOlder) {
      await ExerciseCatalog.deleteOne({ _id: doc._id });
      throw clashError(twin);
    }
  }

  await markExerciseImagesSaved(input.images);
  return toAdminExerciseDTO(doc.toObject() as CatalogLean);
}

export type ExerciseUpdateResult = {
  exercise: AdminExerciseDTO;
  /** Removed images that could not be deleted from Cloudinary. */
  imageCleanupFailures: number;
};

export async function updateAdminExercise(
  id: string,
  input: ExerciseInput,
  expectedUpdatedAt: string
): Promise<ExerciseUpdateResult> {
  assertId(id);
  assertImagesServable(input.images);
  await getDb();

  const current = (await ExerciseCatalog.findById(id).lean()) as CatalogLean | null;
  if (!current) throw notFound("Exercise not found");

  const stale = conflict(
    "Someone saved this exercise after you opened it. Reload the page to see their changes, then edit again.",
    { reason: "stale" }
  );
  if (!current.updatedAt || current.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw stale;

  if (normalizeExerciseName(input.name) !== current.normalizedName || input.name !== current.name) {
    const clash = await findExerciseNameClash(input.name, {
      ignoreId: id,
      ownerId: current.isCustom && current.createdBy ? String(current.createdBy) : null,
    });
    if (clash) throw clashError(clash);
  }

  const updated = (await ExerciseCatalog.findOneAndUpdate(
    { _id: id, updatedAt: current.updatedAt },
    { $set: persistedFields(input) },
    { returnDocument: "after", runValidators: true }
  ).lean()) as CatalogLean | null;
  if (!updated) throw stale;

  await markExerciseImagesSaved(input.images);
  const removed = strings(current.images).filter((url) => !input.images.includes(url));
  const failed = await destroyUnusedExerciseImages(removed);

  return { exercise: toAdminExerciseDTO(updated), imageCleanupFailures: failed.length };
}

/** Archives an exercise: it disappears from pickers but history keeps working. */
export async function archiveAdminExercise(id: string): Promise<AdminExerciseDTO> {
  assertId(id);
  await getDb();
  const doc = (await ExerciseCatalog.findOneAndUpdate(
    { _id: id, archivedAt: null },
    { $set: { archivedAt: new Date() } },
    { returnDocument: "after" }
  ).lean()) as CatalogLean | null;
  if (doc) return toAdminExerciseDTO(doc);
  // Already archived (e.g. a second click) or missing.
  return getAdminExercise(id);
}

export async function restoreAdminExercise(id: string): Promise<AdminExerciseDTO> {
  assertId(id);
  await getDb();
  const current = (await ExerciseCatalog.findById(id).lean()) as CatalogLean | null;
  if (!current) throw notFound("Exercise not found");
  if (!current.archivedAt) return toAdminExerciseDTO(current);

  const clash = await findExerciseNameClash(current.name, {
    ignoreId: id,
    activeOnly: true,
    ownerId: current.isCustom && current.createdBy ? String(current.createdBy) : null,
  });
  if (clash) {
    throw conflict(`"${clash.name}" is already in the catalog, so this copy cannot be restored. Rename it first.`, {
      exerciseId: clash.exerciseId,
      archived: false,
    });
  }

  const doc = (await ExerciseCatalog.findByIdAndUpdate(
    id,
    { $set: { archivedAt: null } },
    { returnDocument: "after" }
  ).lean()) as CatalogLean | null;
  if (!doc) throw notFound("Exercise not found");
  return toAdminExerciseDTO(doc);
}
