/**
 * Body-composition input/display in the user's units (pure, isomorphic).
 * Storage is always kg and cm; lbs users enter lengths in inches.
 */
import { LBS_PER_KG, cmToInches, fromKg, inchesToCm, roundTo, toKg, type LengthUnit, type WeightUnit } from "@/lib/fitness/units";
import {
  BODY_FAT_MAX,
  BODY_FAT_MIN,
  MEASUREMENT_MAX_CM,
  MEASUREMENT_MIN_CM,
} from "@/lib/validation/body-comp";
import { PROFILE_LIMITS } from "@/lib/users/limits";

/** The shared profile limit: a check-in can update the profile weight. */
export const BODY_WEIGHT_MIN_KG = PROFILE_LIMITS.weightKg.min;
export const BODY_WEIGHT_MAX_KG = PROFILE_LIMITS.weightKg.max;

export function lengthUnitFor(weightUnit: WeightUnit): LengthUnit {
  return weightUnit === "lbs" ? "in" : "cm";
}

export interface ParsedField {
  /** Canonical value (kg / cm / %), null when the field is empty. */
  value: number | null;
  error: string | null;
}

function parseNumber(text: string): number | null | "invalid" {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : "invalid";
}

/** Bounds of a body weight in the display unit (for input min/max and messages). */
export function weightBounds(unit: WeightUnit): { min: number; max: number } {
  const factor = unit === "lbs" ? LBS_PER_KG : 1;
  return { min: Math.ceil(BODY_WEIGHT_MIN_KG * factor), max: Math.floor(BODY_WEIGHT_MAX_KG * factor) };
}

export function lengthBounds(unit: LengthUnit): { min: number; max: number } {
  return unit === "in"
    ? { min: Math.ceil(cmToInches(MEASUREMENT_MIN_CM, 0)), max: Math.floor(cmToInches(MEASUREMENT_MAX_CM, 0)) }
    : { min: MEASUREMENT_MIN_CM, max: MEASUREMENT_MAX_CM };
}

export function parseWeightInput(text: string, unit: WeightUnit): ParsedField {
  const parsed = parseNumber(text);
  if (parsed === null) return { value: null, error: null };
  const { min, max } = weightBounds(unit);
  if (parsed === "invalid") return { value: null, error: "Enter a number." };
  const kg = toKg(parsed, unit);
  if (kg < BODY_WEIGHT_MIN_KG || kg > BODY_WEIGHT_MAX_KG) {
    return { value: null, error: `Weight must be between ${min} and ${max} ${unit}.` };
  }
  return { value: roundTo(kg, 2), error: null };
}

export function parseLengthInput(text: string, unit: LengthUnit): ParsedField {
  const parsed = parseNumber(text);
  if (parsed === null) return { value: null, error: null };
  const { min, max } = lengthBounds(unit);
  if (parsed === "invalid") return { value: null, error: "Enter a number." };
  const cm = unit === "in" ? inchesToCm(parsed, 2) : roundTo(parsed, 2);
  if (cm < MEASUREMENT_MIN_CM || cm > MEASUREMENT_MAX_CM) {
    return { value: null, error: `Must be between ${min} and ${max} ${unit}.` };
  }
  return { value: cm, error: null };
}

export function parseBodyFatInput(text: string): ParsedField {
  const parsed = parseNumber(text);
  if (parsed === null) return { value: null, error: null };
  if (parsed === "invalid") return { value: null, error: "Enter a number." };
  if (parsed < BODY_FAT_MIN || parsed > BODY_FAT_MAX) {
    return { value: null, error: `Body fat must be between ${BODY_FAT_MIN} and ${BODY_FAT_MAX}%.` };
  }
  return { value: roundTo(parsed, 1), error: null };
}

/** kg -> display number in the user's unit (1 decimal). */
export function displayWeight(kg: number, unit: WeightUnit): number {
  return fromKg(kg, unit, 1);
}

/** cm -> display number in the user's length unit (1 decimal). */
export function displayLength(cm: number, unit: LengthUnit): number {
  return unit === "in" ? cmToInches(cm, 1) : roundTo(cm, 1);
}

/** Pre-fills an input from a stored value. */
export function weightInputValue(kg: number | null | undefined, unit: WeightUnit): string {
  return kg == null ? "" : String(displayWeight(kg, unit));
}

export function lengthInputValue(cm: number | null | undefined, unit: LengthUnit): string {
  return cm == null ? "" : String(displayLength(cm, unit));
}
