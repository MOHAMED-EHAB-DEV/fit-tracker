import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import BodyComp, { type IAiAnalysis, type IBodyPhoto } from "@/lib/db/models/BodyComp";
import User from "@/lib/db/models/User";
import { HttpError, badRequest, notFound } from "@/lib/api/errors";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { zonedTimeToUtc } from "@/lib/time";
import { updateUserProfile } from "@/lib/users/profile";
import {
  destroyPhoto,
  destroyUploadedQuietly,
  signPhotoUrl,
  uploadPrivatePhoto,
  type ValidatedPhoto,
} from "@/lib/body-comp/photos";
import type { CheckInDTO } from "@/lib/body-comp/dto";
import {
  MEASUREMENT_KEYS,
  type CheckInCreateInput,
  type CheckInUpdateInput,
  type MeasurementsInput,
} from "@/lib/validation/body-comp";

const LIST_FIELDS = "checkInDate dateString weight bodyFatPercent measurements photos aiAnalysis notes";

interface CheckInLean {
  _id: mongoose.Types.ObjectId;
  checkInDate?: Date | null;
  dateString?: string | null;
  weight?: number | null;
  bodyFatPercent?: number | null;
  measurements?: Partial<Record<(typeof MEASUREMENT_KEYS)[number], number | null>> | null;
  photos?: Partial<IBodyPhoto>[] | null;
  aiAnalysis?: Partial<IAiAnalysis> | null;
  notes?: string | null;
}

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function toCheckInDTO(doc: CheckInLean, now: Date = new Date()): CheckInDTO {
  const measurements = doc.measurements
    ? {
        chest: finiteOrNull(doc.measurements.chest),
        waist: finiteOrNull(doc.measurements.waist),
        hips: finiteOrNull(doc.measurements.hips),
        arms: finiteOrNull(doc.measurements.arms),
        thighs: finiteOrNull(doc.measurements.thighs),
      }
    : null;
  const ai = doc.aiAnalysis;
  return {
    _id: doc._id.toString(),
    dateString: doc.dateString || "",
    checkInDate: doc.checkInDate ? new Date(doc.checkInDate).toISOString() : "",
    weightKg: finiteOrNull(doc.weight),
    bodyFatPercent: finiteOrNull(doc.bodyFatPercent),
    measurements: measurements && Object.values(measurements).some((v) => v !== null) ? measurements : null,
    notes: doc.notes || "",
    photos: (doc.photos || []).map((photo) => {
      const signed = signPhotoUrl(photo, now);
      return { angle: photo.angle || "front", url: signed?.url ?? null, expiresAt: signed?.expiresAt ?? null };
    }),
    aiAnalysis: ai
      ? {
          qualitativeNotes: ai.qualitativeNotes || "",
          estimatedBodyFatPercent: finiteOrNull(ai.estimatedBodyFatPercent),
          estimatedBodyFatRange: ai.estimatedBodyFatRange || "",
          comparedToPrevious: ai.comparedToPrevious || "",
          muscleGroupHighlights: Array.isArray(ai.muscleGroupHighlights) ? ai.muscleGroupHighlights : [],
          recommendations: Array.isArray(ai.recommendations) ? ai.recommendations : [],
          modelUsed: ai.modelUsed || "",
          generatedAt: ai.generatedAt ? new Date(ai.generatedAt).toISOString() : null,
        }
      : null,
  };
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");
  return new mongoose.Types.ObjectId(id);
}

export const DEFAULT_PAGE_SIZE = 30;

export async function listCheckIns(
  userId: string,
  options: { limit?: number; before?: string; beforeId?: string } = {}
): Promise<{ checkIns: CheckInDTO[]; hasMore: boolean }> {
  await getDb();
  const limit = options.limit ?? DEFAULT_PAGE_SIZE;
  const filter: Record<string, unknown> = { userId };
  if (options.before) {
    const before = new Date(options.before);
    // Same order as the sort (time, then id), so check-ins sharing a time are not skipped.
    filter.$or = options.beforeId && mongoose.isValidObjectId(options.beforeId)
      ? [{ checkInDate: { $lt: before } }, { checkInDate: before, _id: { $lt: new mongoose.Types.ObjectId(options.beforeId) } }]
      : [{ checkInDate: { $lt: before } }];
  }
  const docs = (await BodyComp.find(filter)
    .select(LIST_FIELDS)
    .sort({ checkInDate: -1, _id: -1 })
    .limit(limit + 1)
    .lean()) as unknown as CheckInLean[];
  const now = new Date();
  return { checkIns: docs.slice(0, limit).map((doc) => toCheckInDTO(doc, now)), hasMore: docs.length > limit };
}

/** The instant stored for a check-in on `dateString`: now for today, local noon for past days. */
function checkInInstant(dateString: string, today: string, timeZone: string): Date {
  return dateString === today ? new Date() : zonedTimeToUtc(dateString, "12:00", timeZone);
}

function cleanMeasurements(m: MeasurementsInput | null | undefined): Record<string, number | null> | null {
  if (!m) return null;
  const result: Record<string, number | null> = {};
  let any = false;
  for (const key of MEASUREMENT_KEYS) {
    const value = m[key] ?? null;
    result[key] = value;
    if (value !== null) any = true;
  }
  return any ? result : null;
}

/** Latest check-in that has a weight (by check-in time). */
async function latestWeighIn(userId: string): Promise<{ _id: mongoose.Types.ObjectId; weight: number } | null> {
  const doc = await BodyComp.findOne({ userId, weight: { $ne: null } })
    .sort({ checkInDate: -1, _id: -1 })
    .select("weight")
    .lean();
  return doc && typeof doc.weight === "number" ? { _id: doc._id as mongoose.Types.ObjectId, weight: doc.weight } : null;
}

/**
 * Keeps fitnessProfile.weightKg (and BMR / targets, via updateUserProfile)
 * equal to the most recent weigh-in. Returns the new profile weight when changed.
 */
async function syncProfileWeight(userId: string): Promise<number | null> {
  const latest = await latestWeighIn(userId);
  if (!latest) return null;
  const user = await User.findById(userId).select("fitnessProfile.weightKg").lean();
  if (user?.fitnessProfile?.weightKg === latest.weight) return null;
  await updateUserProfile(userId, { fitnessProfile: { weightKg: latest.weight } });
  return latest.weight;
}

/**
 * Syncs the profile weight only when `checkInId` is (or was, before the
 * change) the most recent weigh-in: editing an old check-in, or adding a
 * back-dated one, must not undo a newer weight set elsewhere (Settings, a
 * newer check-in). The check-in is already saved, so a failure here is
 * logged, never turned into an error the app would retry.
 */
async function syncIfLatest(
  userId: string,
  checkInId: mongoose.Types.ObjectId,
  latestBefore: { _id: mongoose.Types.ObjectId } | null
): Promise<number | null> {
  try {
    const latestAfter = await latestWeighIn(userId);
    const involved = Boolean(latestBefore?._id.equals(checkInId) || latestAfter?._id.equals(checkInId));
    return involved ? await syncProfileWeight(userId) : null;
  } catch (err) {
    console.error("[body-comp] could not update the profile weight", err);
    return null;
  }
}

export interface MutationResult {
  checkIn: CheckInDTO;
  /** New profile weight (kg) when the profile was updated, else null. */
  profileWeightKg: number | null;
}

export async function createCheckIn(
  userId: string,
  timeZone: string,
  input: CheckInCreateInput,
  photo: ValidatedPhoto | null
): Promise<MutationResult> {
  await getDb();
  const today = getTodayDateString(new Date(), timeZone);
  const dateString = input.dateString ?? today;
  if (dateString > today) throw badRequest("A check-in can't be in the future.");

  let uploaded: { publicId: string; format: string } | null = null;
  if (photo) {
    try {
      uploaded = await uploadPrivatePhoto(photo.buffer);
    } catch (err) {
      console.error("[body-comp] photo upload failed", err);
      throw new HttpError(502, "The photo could not be uploaded. Please try again.");
    }
  }

  let created;
  try {
    created = await BodyComp.create({
      userId,
      checkInDate: checkInInstant(dateString, today, timeZone),
      dateString,
      weight: input.weightKg ?? null,
      bodyFatPercent: input.bodyFatPercent ?? null,
      measurements: cleanMeasurements(input.measurements),
      photos: uploaded
        ? [{ cloudinaryPublicId: uploaded.publicId, angle: "front", deliveryType: "private", format: uploaded.format }]
        : [],
      aiAnalysis: input.aiAnalysis
        ? { ...input.aiAnalysis, generatedAt: new Date(input.aiAnalysis.generatedAt) }
        : null,
      notes: input.notes || null,
    });
  } catch (err) {
    if (uploaded) await destroyUploadedQuietly(uploaded.publicId);
    throw err;
  }

  const profileWeightKg =
    input.weightKg != null ? await syncIfLatest(userId, created._id as mongoose.Types.ObjectId, null) : null;
  return { checkIn: toCheckInDTO(created.toObject() as unknown as CheckInLean), profileWeightKg };
}

export async function updateCheckIn(
  userId: string,
  timeZone: string,
  id: string,
  input: CheckInUpdateInput
): Promise<MutationResult> {
  await getDb();
  const _id = toObjectId(id);
  const existing = await BodyComp.findOne({ _id, userId }).select("dateString weight").lean();
  if (!existing) throw notFound("Check-in not found");

  const set: Record<string, unknown> = {};
  if (input.weightKg !== undefined) set.weight = input.weightKg;
  if (input.bodyFatPercent !== undefined) set.bodyFatPercent = input.bodyFatPercent;
  if (input.measurements !== undefined) set.measurements = cleanMeasurements(input.measurements);
  if (input.notes !== undefined) set.notes = input.notes || null;
  if (input.dateString !== undefined && input.dateString !== existing.dateString) {
    const today = getTodayDateString(new Date(), timeZone);
    if (input.dateString > today) throw badRequest("A check-in can't be in the future.");
    set.dateString = input.dateString;
    set.checkInDate = zonedTimeToUtc(input.dateString, "12:00", timeZone);
  }

  // Only a real change of the weight or the date can move the profile weight.
  const weightChanged = input.weightKg !== undefined && (input.weightKg ?? null) !== (existing.weight ?? null);
  const weightTouched = weightChanged || set.checkInDate !== undefined;
  const latestBefore = weightTouched ? await latestWeighIn(userId) : null;

  const updated = await BodyComp.findOneAndUpdate(
    { _id, userId },
    { $set: set },
    { returnDocument: "after", runValidators: true, projection: LIST_FIELDS }
  ).lean();
  if (!updated) throw notFound("Check-in not found");

  const profileWeightKg = weightTouched ? await syncIfLatest(userId, _id, latestBefore) : null;
  return { checkIn: toCheckInDTO(updated as unknown as CheckInLean), profileWeightKg };
}

/**
 * Deletes a check-in and destroys its photos in Cloudinary first, so a photo
 * can never outlive its check-in.
 */
export async function deleteCheckIn(userId: string, id: string): Promise<{ profileWeightKg: number | null }> {
  await getDb();
  const _id = toObjectId(id);
  const doc = await BodyComp.findOne({ _id, userId }).select("photos weight").lean();
  if (!doc) throw notFound("Check-in not found");

  for (const photo of doc.photos || []) {
    try {
      await destroyPhoto(photo);
    } catch (err) {
      console.error("[body-comp] photo delete failed", err);
      throw new HttpError(502, "The photo could not be deleted right now, so the check-in was kept. Please try again.");
    }
  }

  const latestBefore = doc.weight != null ? await latestWeighIn(userId) : null;
  await BodyComp.deleteOne({ _id, userId });

  // Only when the deleted entry was the latest weigh-in does the profile move back.
  const profileWeightKg = latestBefore ? await syncIfLatest(userId, _id, latestBefore) : null;
  return { profileWeightKg };
}

export interface PromptHistoryEntry {
  dateString: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  measurements: Record<string, number | null> | null;
  notes: string;
  previousAiNotes: string;
}

/** The two latest check-ins, as context for an AI estimate. */
export async function recentCheckInsForPrompt(userId: string): Promise<PromptHistoryEntry[]> {
  await getDb();
  const docs = await BodyComp.find({ userId })
    .sort({ checkInDate: -1 })
    .limit(2)
    .select("dateString weight bodyFatPercent measurements notes aiAnalysis.qualitativeNotes aiAnalysis.estimatedBodyFatPercent")
    .lean();
  return docs.map((doc) => ({
    dateString: doc.dateString || "",
    weightKg: finiteOrNull(doc.weight),
    bodyFatPercent: finiteOrNull(doc.bodyFatPercent) ?? finiteOrNull(doc.aiAnalysis?.estimatedBodyFatPercent),
    measurements: (doc.measurements as Record<string, number | null> | null) || null,
    notes: (doc.notes || "").slice(0, 300),
    previousAiNotes: (doc.aiAnalysis?.qualitativeNotes || "").slice(0, 600),
  }));
}
