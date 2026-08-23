import { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";

/**
 * Calculates Basal Metabolic Rate using the Mifflin-St Jeor equation.
 * Weight in kg, height in cm, age in years.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}

/**
 * Calculates target calories based on fitness goal.
 */
export function calculateTargetCalories(tdee: number, goal: FitnessGoal): number {
  switch (goal) {
    case "cut":
      return Math.round(tdee - 500); // 500 kcal deficit
    case "bulk":
      return Math.round(tdee + 300); // 300 kcal surplus
    case "maintain":
    default:
      return Math.round(tdee);
  }
}

/**
 * Calculates optimal daily protein target in grams (2.0g - 2.2g per kg bodyweight).
 */
export function calculateProteinTarget(weightKg: number, goal: FitnessGoal): number {
  const factor = goal === "cut" ? 2.2 : 2.0; // Higher protein in a deficit to preserve muscle
  return Math.round(weightKg * factor);
}
