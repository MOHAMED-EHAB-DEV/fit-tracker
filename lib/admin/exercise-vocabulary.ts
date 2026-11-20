/**
 * Maps exercise field values (including the spellings older or imported
 * catalog data uses) onto the one vocabulary in `@/lib/workouts/taxonomy`.
 * Isomorphic: used by the admin form, the admin API and its validation.
 */
import {
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  PRIMARY_MUSCLES,
  type Equipment,
  type ExerciseCategory,
} from "@/lib/workouts/taxonomy";

export type PrimaryMuscle = (typeof PRIMARY_MUSCLES)[number];

function key(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

const MUSCLE_BY_KEY = new Map<string, PrimaryMuscle>(PRIMARY_MUSCLES.map((muscle) => [key(muscle), muscle]));
MUSCLE_BY_KEY.set("abs", "Abdominals");
MUSCLE_BY_KEY.set("core", "Abdominals");
MUSCLE_BY_KEY.set("quads", "Quadriceps");
MUSCLE_BY_KEY.set("hams", "Hamstrings");
MUSCLE_BY_KEY.set("delts", "Shoulders");
MUSCLE_BY_KEY.set("trapezius", "Traps");
MUSCLE_BY_KEY.set("lat", "Lats");
MUSCLE_BY_KEY.set("bicep", "Biceps");
MUSCLE_BY_KEY.set("tricep", "Triceps");

const EQUIPMENT_BY_KEY = new Map<string, Equipment>(EQUIPMENT.map((item) => [key(item), item]));
EQUIPMENT_BY_KEY.set("body only", "bodyweight");
EQUIPMENT_BY_KEY.set("body weight", "bodyweight");
EQUIPMENT_BY_KEY.set("none", "bodyweight");
EQUIPMENT_BY_KEY.set("kettlebells", "kettlebell");
EQUIPMENT_BY_KEY.set("dumbbells", "dumbbell");
EQUIPMENT_BY_KEY.set("band", "bands");
EQUIPMENT_BY_KEY.set("resistance band", "bands");
EQUIPMENT_BY_KEY.set("e z curl bar", "barbell");
EQUIPMENT_BY_KEY.set("ez bar", "barbell");
EQUIPMENT_BY_KEY.set("smith machine", "machine");

const CATEGORY_BY_KEY = new Map<string, ExerciseCategory>(EXERCISE_CATEGORIES.map((item) => [key(item), item]));
CATEGORY_BY_KEY.set("stretch", "stretching");
CATEGORY_BY_KEY.set("mobility", "stretching");
CATEGORY_BY_KEY.set("plyometric", "plyometrics");

/** The canonical primary muscle for `value`, or null when it is not in the list. */
export function canonicalPrimaryMuscle(value: string | null | undefined): PrimaryMuscle | null {
  return value ? MUSCLE_BY_KEY.get(key(value)) ?? null : null;
}

export function canonicalEquipment(value: string | null | undefined): Equipment | null {
  return value ? EQUIPMENT_BY_KEY.get(key(value)) ?? null : null;
}

export function canonicalCategory(value: string | null | undefined): ExerciseCategory | null {
  return value ? CATEGORY_BY_KEY.get(key(value)) ?? null : null;
}

export const LEVELS = ["beginner", "intermediate", "expert"] as const;
export const FORCES = ["push", "pull", "static"] as const;
export const MECHANICS = ["compound", "isolation"] as const;
export type ExerciseLevel = (typeof LEVELS)[number];
export type ExerciseForce = (typeof FORCES)[number];
export type ExerciseMechanic = (typeof MECHANICS)[number];

export const EXERCISE_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  maxSecondaryMuscles: 8,
  maxInstructions: 25,
  instructionMax: 1000,
  maxImages: 8,
  imageUrlMax: 2048,
  metMin: 1,
  metMax: 20,
} as const;

/** Secondary muscles in canonical form, without duplicates and without the primary muscle. */
export function cleanSecondaryMuscles(values: readonly string[], primary: string | null): PrimaryMuscle[] {
  const result: PrimaryMuscle[] = [];
  for (const value of values) {
    const muscle = canonicalPrimaryMuscle(value);
    if (muscle && muscle !== primary && !result.includes(muscle)) result.push(muscle);
  }
  return result;
}
