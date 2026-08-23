export type WeightUnit = "kg" | "lbs";

/**
 * Converts kg to lbs rounded to 1 decimal place
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

/**
 * Converts lbs to kg rounded to 1 decimal place
 */
export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

/**
 * Formats a weight value based on the selected unit
 */
export function formatWeight(
  weightInKg: number | null | undefined,
  unit: WeightUnit = "kg",
  includeUnit: boolean = true
): string {
  if (weightInKg == null || isNaN(weightInKg)) {
    return includeUnit ? `0 ${unit}` : "0";
  }
  const val = unit === "lbs" ? kgToLbs(weightInKg) : weightInKg;
  return includeUnit ? `${val.toLocaleString()} ${unit}` : val.toLocaleString();
}
