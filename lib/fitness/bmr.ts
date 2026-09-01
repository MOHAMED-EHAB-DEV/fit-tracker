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
 * Resolves all 5 macro targets strictly from user customized settings or biometric calculations.
 */
export function getUserCustomizedMacroTargets(user: any): IUserMacroTargets {
  const fp = user?.fitnessProfile;
  const weight = fp?.weightKg;
  const height = fp?.heightCm;
  const birthDate = fp?.birthDate;
  const sex: Sex = fp?.sex || "male";
  const activity: ActivityLevel = fp?.activityLevel || "moderate";
  const goal: FitnessGoal = fp?.goal || "maintain";

  let age = fp?.age || 25;
  if (birthDate) {
    const diffMs = Date.now() - new Date(birthDate).getTime();
    age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  }

  let computedBmr = user?.computed?.bmr;
  let computedTdee = user?.computed?.tdee;
  if ((!computedBmr || !computedTdee) && weight && height) {
    computedBmr = calculateBMR(weight, height, age, sex);
    computedTdee = calculateTDEE(computedBmr, activity);
  }

  const calculatedCalories = computedTdee ? calculateTargetCalories(computedTdee, goal) : (computedBmr ? Math.round(computedBmr * 1.55) : 2000);
  const targetCalories = fp?.targetCalories || user?.computed?.tdee || calculatedCalories;

  const calculatedProtein = weight ? calculateProteinTarget(weight, goal) : Math.round((targetCalories * 0.25) / 4);
  const targetProtein = fp?.targetProteinG || user?.computed?.proteinTargetG || calculatedProtein;

  const calculatedFat = calculateFatTarget(targetCalories);
  const targetFat = fp?.targetFatG || user?.computed?.fatTargetG || calculatedFat;

  const calculatedCarbs = calculateCarbsTarget(targetCalories, targetProtein, targetFat);
  const targetCarbs = fp?.targetCarbsG || user?.computed?.carbsTargetG || calculatedCarbs;

  const calculatedFiber = calculateFiberTarget(targetCalories);
  const targetFiber = fp?.targetFiberG || user?.computed?.fiberTargetG || calculatedFiber;

  return {
    calories: targetCalories,
    protein: targetProtein,
    carbs: targetCarbs,
    fat: targetFat,
    fiber: targetFiber,
  };
}

