export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type FitnessGoal = "cut" | "maintain" | "bulk";
export type WeightUnit = "kg" | "lbs";

export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "pre_workout"
  | "post_workout";

export type WorkoutStatus = "active" | "completed" | "abandoned";
export type TemplateCategory =
  | "strength"
  | "hypertrophy"
  | "powerlifting"
  | "calisthenics";

export interface MacroSplit {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}
