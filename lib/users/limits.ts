/**
 * The one set of limits for profile and preference values, shared by the
 * server schemas (lib/validation/profile.ts), Settings and onboarding, so a
 * value the form accepts is never rejected by the server, and the messages
 * say the same thing everywhere. Values are metric.
 */
import { LBS_PER_KG, cmToInches, type WeightUnit } from "@/lib/fitness/units";

export const PROFILE_LIMITS = {
  /** Same as body check-ins (lib/body-comp/units.ts), which can update it. */
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 100, max: 250 },
  age: { min: 10, max: 100 },
  calorieAdjustment: { min: 0, max: 1500 },
  targetCalories: { min: 800, max: 10_000 },
  targetProteinG: { min: 0, max: 600 },
  targetCarbsG: { min: 0, max: 1500 },
  targetFatG: { min: 0, max: 500 },
  targetFiberG: { min: 0, max: 150 },
  stepGoal: { min: 500, max: 100_000 },
  waterGoalMl: { min: 250, max: 10_000 },
  /** 0 turns the rest timer off. */
  restTimerSec: { min: 0, max: 900 },
} as const;

export type ProfileLimitKey = keyof typeof PROFILE_LIMITS;

const number = (value: number) => value.toLocaleString("en-US");

function feetAndInches(cm: number): string {
  const totalInches = Math.round(cmToInches(cm, 1));
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

/** The allowed range in plain words, in the unit the user sees ("between 45 and 881 lbs"). */
export function profileLimitRange(key: ProfileLimitKey, unit: WeightUnit = "kg"): string {
  const { min, max } = PROFILE_LIMITS[key];
  switch (key) {
    case "weightKg":
      return unit === "lbs"
        ? `between ${Math.ceil(min * LBS_PER_KG)} and ${Math.floor(max * LBS_PER_KG)} lbs`
        : `between ${min} and ${max} kg`;
    case "heightCm":
      return unit === "lbs" ? `between ${feetAndInches(min)} and ${feetAndInches(max)}` : `between ${min} and ${max} cm`;
    case "age":
      return `between ${min} and ${max}`;
    case "stepGoal":
      return `between ${number(min)} and ${number(max)}`;
    case "waterGoalMl":
      return `between ${number(min)} and ${number(max)} ml`;
    case "targetCalories":
      return `between ${number(min)} and ${number(max)} kcal`;
    case "calorieAdjustment":
      return `at most ${number(max)} kcal`;
    case "restTimerSec":
      return `at most ${max / 60} minutes`;
    default:
      return `at most ${number(max)} g`;
  }
}

const NAMES: Record<ProfileLimitKey, string> = {
  weightKg: "Weight",
  heightCm: "Height",
  age: "Age",
  calorieAdjustment: "The daily calorie change",
  targetCalories: "The calorie target",
  targetProteinG: "The protein target",
  targetCarbsG: "The carbs target",
  targetFatG: "The fat target",
  targetFiberG: "The fibre target",
  stepGoal: "The step goal",
  waterGoalMl: "The water goal",
  restTimerSec: "The rest timer",
};

/** A message when `value` (metric) is outside the limits, else null. Empty values are fine. */
export function profileLimitProblem(key: ProfileLimitKey, value: number | null | undefined, unit: WeightUnit = "kg"): string | null {
  if (value === null || value === undefined) return null;
  const { min, max } = PROFILE_LIMITS[key];
  if (Number.isFinite(value) && value >= min && value <= max) return null;
  return `${NAMES[key]} must be ${profileLimitRange(key, unit)}.`;
}
