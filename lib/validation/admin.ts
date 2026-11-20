import { z } from "zod";
import { boundedInt, boundedNumber, mealType, objectId } from "@/lib/validation/common";
import { fitnessProfilePatch, preferencesPatch } from "@/lib/validation/profile";
import {
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  MUSCLE_GROUPS,
  PRIMARY_MUSCLES,
  TRACKING_TYPES,
  normalizeExerciseName,
} from "@/lib/workouts/taxonomy";
import {
  EXERCISE_LIMITS as L,
  FORCES,
  LEVELS,
  MECHANICS,
  canonicalCategory,
  canonicalEquipment,
  canonicalPrimaryMuscle,
  cleanSecondaryMuscles,
} from "@/lib/admin/exercise-vocabulary";

/** Request schemas for the admin panel. */

// ── Shared list-query pieces ────────────────────────────────────────────────

const page = z.coerce.number().int().min(1).max(100_000).default(1);
const limit = (fallback: number) => z.coerce.number().int().min(1).max(100).default(fallback);
const sortDir = z.enum(["asc", "desc"]).default("asc");
const search = z.string().trim().max(100).default("");
/** "" from a cleared filter means "no filter". */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional().transform((value) => value || undefined);

/** Escapes text for use inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Exercises ───────────────────────────────────────────────────────────────

const vocabulary = <T extends string>(canonical: (value: string) => T | null, what: string) =>
  z
    .string()
    .trim()
    .min(1, `Choose a ${what}`)
    .transform((value, ctx) => {
      const result = canonical(value);
      if (!result) {
        ctx.addIssue({ code: "custom", message: `"${value}" is not a ${what} from the list` });
        return z.NEVER;
      }
      return result;
    });

const exerciseFields = z
  .object({
    name: z
      .string()
      .trim()
      .min(L.nameMin, `The name needs at least ${L.nameMin} characters`)
      .max(L.nameMax, `The name can have at most ${L.nameMax} characters`)
      .refine((name) => normalizeExerciseName(name).length > 0, "The name must contain Latin letters or numbers"),
    primaryMuscle: vocabulary(canonicalPrimaryMuscle, "primary muscle"),
    secondaryMuscles: z.array(z.string().max(40)).max(20).default([]),
    equipment: vocabulary(canonicalEquipment, "equipment type"),
    category: vocabulary(canonicalCategory, "category"),
    /** "auto" derives it from category, equipment and name. */
    trackingType: z.enum([...TRACKING_TYPES, "auto"]).default("auto"),
    force: z.enum(FORCES).nullable().default(null),
    level: z.enum(LEVELS).nullable().default(null),
    mechanic: z.enum(MECHANICS).nullable().default(null),
    metValue: boundedNumber(L.metMin, L.metMax).transform((value) => Math.round(value * 10) / 10),
    instructions: z
      .array(z.string().trim().max(L.instructionMax, `Each step can have at most ${L.instructionMax} characters`))
      .max(L.maxInstructions, `At most ${L.maxInstructions} steps`)
      .default([])
      .transform((steps) => steps.filter((step) => step.length > 0)),
    images: z
      .array(z.string().trim().min(1).max(L.imageUrlMax))
      .max(L.maxImages, `At most ${L.maxImages} images`)
      .default([])
      .transform((urls) => Array.from(new Set(urls))),
  })
  .transform((value) => {
    const secondaryMuscles = cleanSecondaryMuscles(value.secondaryMuscles, value.primaryMuscle);
    return { ...value, secondaryMuscles: secondaryMuscles.slice(0, L.maxSecondaryMuscles) };
  });

export const exerciseCreateSchema = exerciseFields;
export type ExerciseInput = z.output<typeof exerciseFields>;

export const exerciseUpdateSchema = z.object({
  exercise: exerciseFields,
  /** The `updatedAt` the editor loaded; the save is refused if the exercise changed since. */
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
});

export const exerciseListQuery = z.object({
  page,
  limit: limit(30),
  search,
  muscleGroup: optionalEnum(MUSCLE_GROUPS),
  muscle: optionalEnum(PRIMARY_MUSCLES),
  equipment: optionalEnum(EQUIPMENT),
  category: optionalEnum(EXERCISE_CATEGORIES),
  trackingType: optionalEnum(TRACKING_TYPES),
  type: optionalEnum(["global", "custom"] as const),
  status: z.enum(["active", "archived", "all"]).default("active"),
  completeness: optionalEnum(["incomplete", "missing_images", "missing_instructions"] as const),
  sortField: z.enum(["name", "primaryMuscle", "equipment", "category", "metValue", "createdAt"]).default("name"),
  sortDir,
});
export type ExerciseListQuery = z.output<typeof exerciseListQuery>;

export const imageDiscardSchema = z.object({ url: z.string().trim().min(1).max(L.imageUrlMax) });

// ── Users ───────────────────────────────────────────────────────────────────

export const userListQuery = z.object({
  page,
  limit: limit(20),
  search,
  role: optionalEnum(["user", "admin"] as const),
  isBanned: optionalEnum(["true", "false"] as const),
  sortField: z.enum(["name", "email", "createdAt", "lastLoginAt", "role"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type UserListQuery = z.output<typeof userListQuery>;

export const adminUserPatchSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    isBanned: z.boolean().optional(),
    name: z.string().trim().min(1, "Name cannot be empty").max(80).optional(),
    fitnessProfile: fitnessProfilePatch.optional(),
    preferences: preferencesPatch.optional(),
  })
  .strict()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Nothing to update");
export type AdminUserPatch = z.output<typeof adminUserPatchSchema>;

// ── Nutrition plans ─────────────────────────────────────────────────────────

const planMeal = z.object({
  mealType,
  name: z.string().trim().min(1, "Each meal needs a name").max(100),
  description: z.string().trim().max(500).default(""),
  targetCalories: boundedNumber(0, 5000),
  macros: z.object({
    protein: boundedNumber(0, 500),
    carbs: boundedNumber(0, 1000),
    fat: boundedNumber(0, 500),
    fiber: boundedNumber(0, 200).default(0),
  }),
});

export const nutritionPlanSchema = z.object({
  name: z.string().trim().min(1, "The plan needs a name").max(120),
  description: z.string().trim().max(1000).default(""),
  targetCalories: boundedInt(800, 10_000),
  targetProteinG: boundedInt(0, 600).default(0),
  targetCarbsG: boundedInt(0, 1500).default(0),
  targetFatG: boundedInt(0, 500).default(0),
  meals: z.array(planMeal).max(12, "At most 12 meals").default([]),
  isPublic: z.boolean().default(false),
});
export type NutritionPlanInput = z.output<typeof nutritionPlanSchema>;

export const planListQuery = z.object({
  page,
  limit: limit(20),
  search,
  isPublic: optionalEnum(["true", "false"] as const),
  sortField: z.enum(["name", "targetCalories", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type PlanListQuery = z.output<typeof planListQuery>;

export const planAssigneesSchema = z
  .object({
    add: z.array(objectId).max(200).default([]),
    remove: z.array(objectId).max(200).default([]),
  })
  .refine((value) => value.add.length + value.remove.length > 0, "Choose at least one user");

// ── Meals (moderation) ──────────────────────────────────────────────────────

export const adminMealListQuery = z.object({
  page,
  limit: limit(30),
  userId: objectId.optional(),
  mealType: z.union([mealType, z.literal("")]).optional().transform((value) => value || undefined),
  imageSource: optionalEnum(["photo", "text_only"] as const),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const adminMealPatchSchema = z
  .object({
    mealType: mealType.optional(),
    description: z.string().trim().max(1000).optional(),
    macros: z
      .object({
        calories: boundedNumber(0, 20_000),
        protein: boundedNumber(0, 2_000),
        carbs: boundedNumber(0, 3_000),
        fat: boundedNumber(0, 2_000),
        fiber: boundedNumber(0, 500),
      })
      .optional(),
  })
  .strict()
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), "Nothing to update");
