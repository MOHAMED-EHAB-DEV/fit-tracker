import { z } from "zod";
import { bodyWeightKg, boundedNumber, dateString, trimmedText } from "@/lib/validation/common";

/** Body circumferences, stored in centimetres. */
export const MEASUREMENT_KEYS = ["chest", "waist", "hips", "arms", "thighs"] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

export const MEASUREMENT_MIN_CM = 10;
export const MEASUREMENT_MAX_CM = 300;
export const BODY_FAT_MIN = 0;
export const BODY_FAT_MAX = 75;
export const NOTES_MAX = 1000;

const measurementCm = boundedNumber(MEASUREMENT_MIN_CM, MEASUREMENT_MAX_CM).nullable().optional();

export const measurementsSchema = z
  .object({
    chest: measurementCm,
    waist: measurementCm,
    hips: measurementCm,
    arms: measurementCm,
    thighs: measurementCm,
  })
  .strict();

export type MeasurementsInput = z.infer<typeof measurementsSchema>;

export const bodyFatPercentSchema = boundedNumber(BODY_FAT_MIN, BODY_FAT_MAX);

/** An AI estimate as stored with a check-in (after the user saw and accepted it). */
export const storedAnalysisSchema = z.object({
  qualitativeNotes: trimmedText(4000),
  estimatedBodyFatPercent: boundedNumber(3, 60).nullable(),
  estimatedBodyFatRange: trimmedText(60),
  comparedToPrevious: trimmedText(2000),
  muscleGroupHighlights: z.array(trimmedText(160)).max(12),
  recommendations: z.array(trimmedText(500)).max(10),
  modelUsed: trimmedText(80, 1),
  generatedAt: z.string().datetime(),
});

export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>;

const checkInFields = {
  weightKg: bodyWeightKg.nullable().optional(),
  bodyFatPercent: bodyFatPercentSchema.nullable().optional(),
  measurements: measurementsSchema.nullable().optional(),
  notes: trimmedText(NOTES_MAX).optional(),
  /** Calendar day of the check-in in the user's zone; defaults to today. */
  dateString: dateString.optional(),
};

function hasAnyMeasurement(m: MeasurementsInput | null | undefined): boolean {
  return Boolean(m && Object.values(m).some((v) => v != null));
}

/** Fields of a new check-in (the photo, if any, travels separately). */
export const checkInCreateSchema = z.object({
  ...checkInFields,
  aiAnalysis: storedAnalysisSchema.nullable().optional(),
});

export type CheckInCreateInput = z.infer<typeof checkInCreateSchema>;

/** True when a new check-in carries at least one measurement or a photo. */
export function hasCheckInContent(input: CheckInCreateInput, hasPhoto: boolean): boolean {
  return (
    hasPhoto ||
    input.weightKg != null ||
    input.bodyFatPercent != null ||
    hasAnyMeasurement(input.measurements)
  );
}

export const checkInUpdateSchema = z
  .object(checkInFields)
  .refine((value) => Object.values(value).some((v) => v !== undefined), "Nothing to update");

export type CheckInUpdateInput = z.infer<typeof checkInUpdateSchema>;

/** Optional context sent with an AI estimate request. */
export const estimateFieldsSchema = z.object({
  weightKg: bodyWeightKg.nullable().optional(),
  measurements: measurementsSchema.nullable().optional(),
  notes: trimmedText(NOTES_MAX).optional(),
});

export const checkInListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  /** ISO timestamp: return check-ins strictly older than this. */
  before: z.string().datetime().optional(),
  /** The last check-in already shown: check-ins at the same instant come after it by id. */
  beforeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

/**
 * Reads a numeric form field: "" / missing -> undefined, otherwise a Number
 * (NaN and Infinity are rejected later by the schema).
 */
export function formNumber(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null) return undefined;
  if (typeof value !== "string") return Number.NaN;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed === "null") return null;
  return Number(trimmed);
}

/** Reads a JSON form field; invalid JSON becomes a value the schema rejects. */
export function formJson(value: FormDataEntryValue | null): unknown {
  if (value === null || value === "") return undefined;
  if (typeof value !== "string") return "__invalid_json__";
  try {
    return JSON.parse(value);
  } catch {
    return "__invalid_json__";
  }
}

export function formText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
