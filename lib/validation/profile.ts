import { z } from "zod";
import {
  bodyWeightKg,
  boundedInt,
  dateString,
  heightCm,
  timeZone,
  weekdayKey,
  weightUnit,
} from "@/lib/validation/common";

export const sex = z.enum(["male", "female"]);
export const activityLevel = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const fitnessGoal = z.enum(["cut", "maintain", "bulk"]);

/** Every field is optional: only the fields sent are changed. */
export const fitnessProfilePatch = z
  .object({
    sex: sex.optional(),
    birthDate: dateString.nullable().optional(),
    age: boundedInt(10, 100).nullable().optional(),
    weightKg: bodyWeightKg.nullable().optional(),
    heightCm: heightCm.nullable().optional(),
    activityLevel: activityLevel.optional(),
    goal: fitnessGoal.optional(),
    calorieAdjustment: boundedInt(0, 1500).nullable().optional(),
    // Custom targets. null = "calculate it for me".
    targetCalories: boundedInt(800, 10_000).nullable().optional(),
    targetProteinG: boundedInt(0, 600).nullable().optional(),
    targetCarbsG: boundedInt(0, 1500).nullable().optional(),
    targetFatG: boundedInt(0, 500).nullable().optional(),
    targetFiberG: boundedInt(0, 150).nullable().optional(),
  })
  .strict();

export const preferencesPatch = z
  .object({
    stepGoal: boundedInt(500, 100_000).nullable().optional(),
    waterGoalMl: boundedInt(250, 10_000).nullable().optional(),
    // 0 turns the rest timer off.
    restTimerDefaultSec: boundedInt(0, 900).nullable().optional(),
    weightUnit: weightUnit.optional(),
    timezone: timeZone.optional(),
    weekStartDay: weekdayKey.optional(),
  })
  .strict();

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    fitnessProfile: fitnessProfilePatch.optional(),
    preferences: preferencesPatch.optional(),
    /** A new personal Gemini key, or null to remove the saved one. */
    // Letters, digits, "-" and "_" only: a stray line break would otherwise end
    // up in a request header (and in the error message that rejects it).
    customGeminiApiKey: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{10,200}$/, "That does not look like a Gemini API key")
      .nullable()
      .optional(),
    invalidateAllSessions: z.boolean().optional(),
  })
  .strict();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const onboardingSchema = z.object({
  sex,
  age: z.coerce.number().int().min(10).max(100).optional(),
  birthDate: dateString.nullable().optional(),
  weightKg: z.coerce.number().min(30, "Weight must be at least 30 kg").max(300, "Weight must be at most 300 kg"),
  heightCm: z.coerce.number().min(100, "Height must be at least 100 cm").max(250, "Height must be at most 250 cm"),
  activityLevel,
  goal: fitnessGoal,
  stepGoal: z.coerce.number().int().min(500).max(100_000).optional(),
  waterGoalMl: z.coerce.number().int().min(250).max(10_000).optional(),
  restTimerDefaultSec: z.coerce.number().int().min(10).max(900).optional(),
  weightUnit: weightUnit.optional(),
  timezone: timeZone.optional(),
});
