/**
 * Exercise option lists for forms and filters. The vocabulary itself lives in
 * `@/lib/workouts/taxonomy`; this file only shapes it for UI controls.
 */
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  EXERCISE_CATEGORIES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  PRIMARY_MUSCLES,
  TRACKING_TYPES,
  TRACKING_TYPE_LABELS,
  type Equipment,
  type ExerciseCategory,
} from "@/lib/workouts/taxonomy";
import {
  FORCES,
  LEVELS,
  MECHANICS,
  type ExerciseForce,
  type ExerciseLevel,
  type ExerciseMechanic,
  type PrimaryMuscle,
} from "@/lib/admin/exercise-vocabulary";

export {
  EQUIPMENT_LABELS,
  FORCES,
  LEVELS,
  MECHANICS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  TRACKING_TYPES,
  TRACKING_TYPE_LABELS,
};
export type { Equipment, ExerciseCategory, ExerciseForce, ExerciseLevel, ExerciseMechanic };

interface Option {
  value: string;
  label: string;
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Specific muscles, as stored in `primaryMuscle`. */
export const MUSCLES = PRIMARY_MUSCLES;
export type Muscle = PrimaryMuscle;
export const MUSCLE_OPTIONS: Option[] = PRIMARY_MUSCLES.map((muscle) => ({ value: muscle, label: muscle }));

export const MUSCLE_GROUP_OPTIONS: Option[] = MUSCLE_GROUPS.map((group) => ({
  value: group,
  label: MUSCLE_GROUP_LABELS[group],
}));

export const EQUIPMENT_OPTIONS = EQUIPMENT;
export type EquipmentOption = Equipment;
export const EQUIPMENT_SELECT_OPTIONS: Option[] = EQUIPMENT.map((item) => ({
  value: item,
  label: EQUIPMENT_LABELS[item],
}));

export const CATEGORIES = EXERCISE_CATEGORIES;
export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: "Strength",
  stretching: "Stretching & mobility",
  plyometrics: "Plyometrics",
  powerlifting: "Powerlifting",
  "olympic weightlifting": "Olympic weightlifting",
  strongman: "Strongman",
  cardio: "Cardio",
};
export const CATEGORY_OPTIONS: Option[] = EXERCISE_CATEGORIES.map((item) => ({
  value: item,
  label: CATEGORY_LABELS[item],
}));

export const TRACKING_TYPE_OPTIONS: Option[] = TRACKING_TYPES.map((type) => ({
  value: type,
  label: TRACKING_TYPE_LABELS[type],
}));

export const LEVEL_OPTIONS: Option[] = LEVELS.map((value) => ({ value, label: titleCase(value) }));
export const FORCE_OPTIONS: Option[] = FORCES.map((value) => ({ value, label: titleCase(value) }));
export const MECHANIC_OPTIONS: Option[] = MECHANICS.map((value) => ({ value, label: titleCase(value) }));

/** Quick filters in the user-facing exercise picker. */
export const EXERCISE_SEARCH_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "strength", label: "Strength" },
  { id: "stretching", label: "Stretches & Mobility" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "cardio", label: "Cardio" },
  { id: "plyometrics", label: "Plyometrics" },
] as const;
