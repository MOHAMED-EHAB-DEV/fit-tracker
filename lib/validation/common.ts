import { z } from "zod";
import { isValidDateString, isValidTimeZone } from "@/lib/time";

/** Building blocks shared by every request schema. */

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const dateString = z
  .string()
  .refine(isValidDateString, "Date must be a real calendar date in YYYY-MM-DD format");

export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour)");

export const timeZone = z.string().refine(isValidTimeZone, "Unknown time zone");

export const weightUnit = z.enum(["kg", "lbs"]);

export const weekdayKey = z.enum([
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

export const trimmedText = (max: number, min: number = 0) => z.string().trim().min(min).max(max);

/** A finite number within bounds; rejects NaN, Infinity and strings. */
export const boundedNumber = (min: number, max: number) => z.number().finite().min(min).max(max);

export const boundedInt = (min: number, max: number) => z.number().int().min(min).max(max);

/** Nutrition values for one meal or item. */
export const macros = z.object({
  calories: boundedNumber(0, 20_000),
  protein: boundedNumber(0, 2_000),
  carbs: boundedNumber(0, 3_000),
  fat: boundedNumber(0, 2_000),
  fiber: boundedNumber(0, 500).optional().default(0),
});

export const mealType = z.enum(["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"]);

/** Body weight in kilograms. */
export const bodyWeightKg = boundedNumber(20, 400);
export const heightCm = boundedNumber(90, 260);
