/**
 * Daily targets from a fitness profile. Pure (no database, no framework), so
 * the server and the browser show exactly the same numbers.
 */
import {
  calculateBMR,
  calculateCarbsTarget,
  calculateFatTarget,
  calculateFiberTarget,
  calculateProteinTarget,
  calculateTDEE,
  calculateTargetCalories,
} from "@/lib/fitness/bmr";
import type { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";

export interface ProfileFields {
  sex?: Sex | null;
  birthDate?: Date | string | null;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  activityLevel?: ActivityLevel | null;
  goal?: FitnessGoal | null;
  calorieAdjustment?: number | null;
  targetCalories?: number | null;
  targetProteinG?: number | null;
  targetCarbsG?: number | null;
  targetFatG?: number | null;
  targetFiberG?: number | null;
}

/** Age in whole years from the birth date (preferred) or the stored age. */
export function ageFromProfile(profile: ProfileFields, now: Date = new Date()): number {
  if (profile.birthDate) {
    const born = new Date(profile.birthDate);
    if (!Number.isNaN(born.getTime())) {
      let age = now.getUTCFullYear() - born.getUTCFullYear();
      const beforeBirthday =
        now.getUTCMonth() < born.getUTCMonth() ||
        (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
      if (beforeBirthday) age -= 1;
      if (age >= 10 && age <= 110) return age;
    }
  }
  return profile.age && profile.age >= 10 ? profile.age : 25;
}

export interface ComputedTargets {
  bmr: number | null;
  tdee: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  fiberTargetG: number | null;
  /** The automatic calorie target (before any custom override). */
  calorieTarget: number | null;
}

/** BMR, TDEE and effective daily targets (custom values win over automatic ones). */
export function computeTargets(profile: ProfileFields): ComputedTargets {
  const { weightKg, heightCm } = profile;
  if (!weightKg || !heightCm) {
    return {
      bmr: null,
      tdee: null,
      proteinTargetG: profile.targetProteinG ?? null,
      carbsTargetG: profile.targetCarbsG ?? null,
      fatTargetG: profile.targetFatG ?? null,
      fiberTargetG: profile.targetFiberG ?? null,
      calorieTarget: profile.targetCalories ?? null,
    };
  }

  const sex: Sex = profile.sex || "male";
  const activity: ActivityLevel = profile.activityLevel || "moderate";
  const goal: FitnessGoal = profile.goal || "maintain";

  const bmr = calculateBMR(weightKg, heightCm, ageFromProfile(profile), sex);
  const tdee = calculateTDEE(bmr, activity);
  const autoCalories = calculateTargetCalories(tdee, goal, profile.calorieAdjustment);
  const calories = profile.targetCalories ?? autoCalories;
  const protein = profile.targetProteinG ?? calculateProteinTarget(weightKg, goal);
  const fat = profile.targetFatG ?? calculateFatTarget(calories);
  const carbs = profile.targetCarbsG ?? calculateCarbsTarget(calories, protein, fat);
  const fiber = profile.targetFiberG ?? calculateFiberTarget(calories);

  return {
    bmr,
    tdee,
    proteinTargetG: protein,
    carbsTargetG: carbs,
    fatTargetG: fat,
    fiberTargetG: fiber,
    calorieTarget: autoCalories,
  };
}

export interface DailyTargets {
  /** null when the profile has no weight or height and no custom value. */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  bmr: number | null;
  tdee: number | null;
}

/** The targets the app actually uses for a profile: custom values first, then calculated ones. */
export function dailyTargets(profile: ProfileFields | null | undefined): DailyTargets {
  const computed = computeTargets(profile || {});
  return {
    calories: profile?.targetCalories ?? computed.calorieTarget,
    protein: computed.proteinTargetG,
    carbs: computed.carbsTargetG,
    fat: computed.fatTargetG,
    fiber: computed.fiberTargetG,
    bmr: computed.bmr,
    tdee: computed.tdee,
  };
}

/**
 * The targets calculated from the profile alone, ignoring custom overrides
 * (shown as "automatic" next to the fields where a custom value can be typed).
 */
export function automaticTargets(profile: ProfileFields | null | undefined): DailyTargets {
  return dailyTargets({
    ...(profile || {}),
    targetCalories: null,
    targetProteinG: null,
    targetCarbsG: null,
    targetFatG: null,
    targetFiberG: null,
  });
}
