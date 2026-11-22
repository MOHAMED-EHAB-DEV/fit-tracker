import { z } from "zod";
import { boundedInt, boundedNumber, dateString, timeZone, weekdayKey, weightUnit } from "@/lib/validation/common";
import { PROFILE_LIMITS as L, profileLimitRange } from "@/lib/users/limits";

/** A number inside one of the shared profile limits (lib/users/limits.ts). */
const limitedInt = (key: keyof typeof L) => boundedInt(L[key].min, L[key].max);
const weightKg = boundedNumber(L.weightKg.min, L.weightKg.max);
const heightCm = boundedNumber(L.heightCm.min, L.heightCm.max);

export const sex = z.enum(["male", "female"]);
export const activityLevel = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
export const fitnessGoal = z.enum(["cut", "maintain", "bulk"]);

/** Every field is optional: only the fields sent are changed. */
export const fitnessProfilePatch = z
  .object({
    sex: sex.optional(),
    birthDate: dateString.nullable().optional(),
    age: limitedInt("age").nullable().optional(),
    weightKg: weightKg.nullable().optional(),
    heightCm: heightCm.nullable().optional(),
    activityLevel: activityLevel.optional(),
    goal: fitnessGoal.optional(),
    calorieAdjustment: limitedInt("calorieAdjustment").nullable().optional(),
    // Custom targets. null = "calculate it for me".
    targetCalories: limitedInt("targetCalories").nullable().optional(),
    targetProteinG: limitedInt("targetProteinG").nullable().optional(),
    targetCarbsG: limitedInt("targetCarbsG").nullable().optional(),
    targetFatG: limitedInt("targetFatG").nullable().optional(),
    targetFiberG: limitedInt("targetFiberG").nullable().optional(),
  })
  .strict();

export const preferencesPatch = z
  .object({
    stepGoal: limitedInt("stepGoal").nullable().optional(),
    waterGoalMl: limitedInt("waterGoalMl").nullable().optional(),
    // 0 turns the rest timer off.
    restTimerDefaultSec: limitedInt("restTimerSec").nullable().optional(),
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
  age: z.coerce.number().int().min(L.age.min).max(L.age.max).optional(),
  birthDate: dateString.nullable().optional(),
  weightKg: z.coerce
    .number()
    .min(L.weightKg.min, `Weight must be ${profileLimitRange("weightKg")}`)
    .max(L.weightKg.max, `Weight must be ${profileLimitRange("weightKg")}`),
  heightCm: z.coerce
    .number()
    .min(L.heightCm.min, `Height must be ${profileLimitRange("heightCm")}`)
    .max(L.heightCm.max, `Height must be ${profileLimitRange("heightCm")}`),
  activityLevel,
  goal: fitnessGoal,
  stepGoal: z.coerce.number().int().min(L.stepGoal.min).max(L.stepGoal.max).optional(),
  waterGoalMl: z.coerce.number().int().min(L.waterGoalMl.min).max(L.waterGoalMl.max).optional(),
  restTimerDefaultSec: z.coerce.number().int().min(L.restTimerSec.min).max(L.restTimerSec.max).optional(),
  weightUnit: weightUnit.optional(),
  timezone: timeZone.optional(),
});
