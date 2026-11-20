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
export function calculateTargetCalories(
  tdee: number,
  goal: FitnessGoal,
  adjustment?: number | null
): number {
  switch (goal) {
    case "cut": {
      const deficit =
        adjustment != null && !isNaN(Number(adjustment)) && Number(adjustment) > 0
          ? Math.round(Number(adjustment))
          : 500;
      return Math.max(1000, Math.round(tdee - deficit));
    }
    case "bulk": {
      const surplus =
        adjustment != null && !isNaN(Number(adjustment)) && Number(adjustment) > 0
          ? Math.round(Number(adjustment))
          : 300;
      return Math.round(tdee + surplus);
    }
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

/**
 * Calculates optimal daily carb target in grams based on remaining caloric budget.
 */
export function calculateCarbsTarget(targetCalories: number, targetProteinG: number, targetFatG: number): number {
  const remainingCalories = Math.max(0, targetCalories - (targetProteinG * 4) - (targetFatG * 9));
  return Math.round(remainingCalories / 4);
}

/**
 * Calculates optimal daily fat target in grams (25% of caloric intake).
 */
export function calculateFatTarget(targetCalories: number): number {
  return Math.round((targetCalories * 0.25) / 9);
}

/**
 * Calculates daily fiber target in grams (14g per 1000 kcal).
 */
export function calculateFiberTarget(targetCalories: number): number {
  return Math.max(25, Math.round((targetCalories / 1000) * 14));
}

export interface IUserMacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * Calculates complete 100% mathematically consistent BMR, TDEE, and macro targets.
 */
export function calculateAllMacroTargets(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  calorieAdjustment?: number | null;
}) {
  const bmr = calculateBMR(params.weightKg, params.heightCm, params.age, params.sex);
  const tdee = calculateTDEE(bmr, params.activityLevel);
  const calories = calculateTargetCalories(tdee, params.goal, params.calorieAdjustment);
  const protein = calculateProteinTarget(params.weightKg, params.goal);
  const fat = calculateFatTarget(calories);
  const carbs = calculateCarbsTarget(calories, protein, fat);
  const fiber = calculateFiberTarget(calories);

  return {
    bmr,
    tdee,
    calories,
    protein,
    carbs,
    fat,
    fiber,
  };
}
