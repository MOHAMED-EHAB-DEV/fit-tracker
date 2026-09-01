/**
 * Calorie calculation utilities for Resistance Training & Workout Sessions.
 *
 * Resistance Training Energy Expenditure Formula:
 * - Active work phase: ~3.5 seconds per repetition under tension at exercise-specific MET from DB.
 * - Load intensity factor: mechanical resistance load relative to user body weight.
 * - Rest/Recovery phase: metabolic energy expended between sets (2.0 MET recovery).
 *
 * All inputs (MET, body weight, reps, load, rest) are derived directly from the DB.
 */

export interface SetCalorieInput {
  reps: number;
  weight: number;
  metValue: number;
  userWeightKg: number;
  isWarmup?: boolean;
  restSeconds?: number;
  weightUnit?: "kg" | "lbs";
}

/**
 * Calculates energy expenditure for an individual resistance training set using exact values from DB.
 */
export function calculateSetCalories({
  reps,
  weight,
  metValue,
  userWeightKg,
  isWarmup = false,
  restSeconds = 0,
  weightUnit = "kg",
}: SetCalorieInput): number {
  if (reps <= 0 || metValue <= 0 || userWeightKg <= 0) {
    return 0;
  }

  const rawWeight = weight > 0 ? weight : 0;
  const weightInKg = weightUnit === "lbs" ? rawWeight / 2.20462 : rawWeight;

  const workDurationSeconds = reps * 3.5;
  const workDurationHours = workDurationSeconds / 3600;

  const effectiveMet = isWarmup ? metValue * 0.75 : metValue;
  const loadFactor = weightInKg > 0 ? 1 + (weightInKg / userWeightKg) * 0.15 : 1;

  const workCalories = effectiveMet * userWeightKg * workDurationHours * loadFactor;
  const restDurationHours = restSeconds > 0 ? restSeconds / 3600 : 0;
  const restCalories = restSeconds > 0 ? 2.0 * userWeightKg * restDurationHours : 0;

  return Math.round((workCalories + restCalories) * 10) / 10;
}

/**
 * Calculates calories burned for what is DONE in an active workout session.
 * Strictly counts completed sets using exact MET, weights, reps, and user weight from DB.
 */
export function calculateSessionDoneCalories(
  exercises: any[],
  userWeightKg: number
): number {
  if (!userWeightKg || userWeightKg <= 0 || !Array.isArray(exercises)) {
    return 0;
  }

  let totalCalories = 0;

  for (const ex of exercises) {
    const met = Number(ex.metValue);
    if (!met || met <= 0) continue;

    const unit = ex.weightUnit;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    for (const s of sets) {
      const isCompleted = Boolean(s.completedAt || (s.completedReps && s.completedReps > 0));
      if (!isCompleted) continue;

      const reps = Number(s.completedReps) || 0;
      const weight = Number(s.weight) || 0;
      const restSeconds = Number(s.restSeconds) || 0;

      if (reps > 0) {
        totalCalories += calculateSetCalories({
          reps,
          weight,
          metValue: met,
          userWeightKg,
          isWarmup: Boolean(s.isWarmup),
          restSeconds,
          weightUnit: unit,
        });
      }
    }
  }

  return Math.round(totalCalories);
}

/**
 * Calculates total planned calories for a routine template based on all planned sets.
 */
export function calculateRoutinePlannedCalories(
  exercises: any[],
  userWeightKg: number
): number {
  if (!userWeightKg || userWeightKg <= 0 || !Array.isArray(exercises)) {
    return 0;
  }

  let totalCalories = 0;

  for (const ex of exercises) {
    const met = Number(ex.metValue);
    if (!met || met <= 0) continue;

    const unit = ex.weightUnit;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    for (const s of sets) {
      const reps = Number(s.targetReps) || 0;
      const weight = Number(s.targetWeight) || 0;
      const restSeconds = Number(s.restSeconds) || 0;

      if (reps > 0) {
        totalCalories += calculateSetCalories({
          reps,
          weight,
          metValue: met,
          userWeightKg,
          isWarmup: Boolean(s.isWarmup),
          restSeconds,
          weightUnit: unit,
        });
      }
    }
  }

  return Math.round(totalCalories);
}
