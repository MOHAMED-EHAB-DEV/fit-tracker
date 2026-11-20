/**
 * Unit conversion. The database stores canonical metric values (kg, cm);
 * conversion happens only at input and display.
 */
export type WeightUnit = "kg" | "lbs";
export type LengthUnit = "cm" | "in";

export const LBS_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

export function roundTo(value: number, decimals: number = 1): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeWeightUnit(unit: unknown): WeightUnit {
  return unit === "lbs" || unit === "lb" ? "lbs" : "kg";
}

/** Converts a value entered in `unit` to kilograms (kept precise to 3 decimals). */
export function toKg(value: number, unit: WeightUnit = "kg"): number {
  if (!Number.isFinite(value)) return 0;
  return roundTo(unit === "lbs" ? value / LBS_PER_KG : value, 3);
}

/** Converts kilograms to the display unit. */
export function fromKg(kg: number, unit: WeightUnit = "kg", decimals: number = 1): number {
  if (!Number.isFinite(kg)) return 0;
  return roundTo(unit === "lbs" ? kg * LBS_PER_KG : kg, decimals);
}

/** Converts kg to lbs rounded to 1 decimal place. */
export function kgToLbs(kg: number): number {
  return fromKg(kg, "lbs", 1);
}

/** Converts lbs to kg rounded to 1 decimal place. */
export function lbsToKg(lbs: number): number {
  return roundTo(lbs / LBS_PER_KG, 1);
}

export function cmToInches(cm: number, decimals: number = 1): number {
  return roundTo(cm / CM_PER_INCH, decimals);
}

export function inchesToCm(inches: number, decimals: number = 1): number {
  return roundTo(inches * CM_PER_INCH, decimals);
}

function trimNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Formats a weight stored in kg for display in the user's unit. */
export function formatWeight(
  weightInKg: number | null | undefined,
  unit: WeightUnit = "kg",
  includeUnit: boolean = true
): string {
  if (weightInKg == null || Number.isNaN(weightInKg)) {
    return includeUnit ? `0 ${unit}` : "0";
  }
  const text = trimNumber(fromKg(weightInKg, unit, 1));
  return includeUnit ? `${text} ${unit}` : text;
}

/** Formats a training volume stored in kg (whole numbers, thousands separators). */
export function formatVolume(volumeKg: number | null | undefined, unit: WeightUnit = "kg"): string {
  const value = Math.round(fromKg(volumeKg || 0, unit, 0));
  return `${value.toLocaleString("en-US")} ${unit}`;
}

/** Smallest sensible plate jump for the unit (used by +/- steppers). */
export function weightStep(unit: WeightUnit = "kg"): number {
  return unit === "lbs" ? 5 : 2.5;
}
