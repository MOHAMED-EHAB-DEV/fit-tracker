import type { ActivityLevel, FitnessGoal, Sex, WeightUnit } from "@/types/fitness";

export const DEFAULT_TIMEZONE = "Africa/Cairo";
export const DEFAULT_REST_TIMER_SEC = 90;
export const DEFAULT_WEEK_START_DAY = "saturday";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export interface ActivityLevelItem {
  key: ActivityLevel;
  label: string;
  desc: string;
  multiplier: number;
}

export const ACTIVITY_LEVELS: ActivityLevelItem[] = [
  {
    key: "sedentary",
    label: "Sedentary (desk job)",
    desc: "Desk job, little to no regular exercise",
    multiplier: 1.2,
  },
  {
    key: "light",
    label: "Lightly Active (1-3 days/wk)",
    desc: "Light exercise / training 1–3 days per week",
    multiplier: 1.375,
  },
  {
    key: "moderate",
    label: "Moderately Active (3-5 days/wk)",
    desc: "Resistance training or sports 3–5 days per week",
    multiplier: 1.55,
  },
  {
    key: "active",
    label: "Active (6-7 days/wk)",
    desc: "Hard training 6–7 days per week",
    multiplier: 1.725,
  },
  {
    key: "very_active",
    label: "Very Active (athlete)",
    desc: "Heavy physical job or dual daily training sessions",
    multiplier: 1.9,
  },
];

export const ACTIVITY_LEVEL_KEYS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

export interface FitnessGoalItem {
  key: FitnessGoal;
  title: string;
  label: string;
  badge: string;
  calorieOffset: number;
  proteinFactor: number;
}

export const FITNESS_GOALS: FitnessGoalItem[] = [
  {
    key: "cut",
    title: "Fat Loss",
    label: "Fat Loss (Cut -500 kcal)",
    badge: "-500 kcal",
    calorieOffset: -500,
    proteinFactor: 2.2,
  },
  {
    key: "maintain",
    title: "Maintain",
    label: "Maintain Weight",
    badge: "Recomp",
    calorieOffset: 0,
    proteinFactor: 2.0,
  },
  {
    key: "bulk",
    title: "Muscle Gain",
    label: "Muscle Gain (Bulk +300 kcal)",
    badge: "+300 kcal",
    calorieOffset: 300,
    proteinFactor: 2.0,
  },
];

export const FITNESS_GOAL_KEYS: FitnessGoal[] = ["cut", "maintain", "bulk"];

export const WEIGHT_UNITS: WeightUnit[] = ["kg", "lbs"];
