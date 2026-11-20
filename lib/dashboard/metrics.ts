/** Today's metric cards (pure). */

import { stepCalories } from "@/lib/fitness/steps";

// Step energy has one definition (lib/fitness/steps), shared with the server.
export { KCAL_PER_STEP, stepCalories } from "@/lib/fitness/steps";

export interface GoalProgress {
  /** Real percentage (can exceed 100); null without a goal. */
  percent: number | null;
  /** Bar width 0-100. */
  barPercent: number;
  isOver: boolean;
  /** Amount above the goal (0 when not over). */
  overBy: number;
  /** Amount still left to the goal (0 when reached). */
  remaining: number;
}

export function goalProgress(value: number | null | undefined, goal: number | null | undefined): GoalProgress {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof goal !== "number" || !Number.isFinite(goal) || goal <= 0) {
    return { percent: null, barPercent: 0, isOver: false, overBy: 0, remaining: 0 };
  }
  const percent = Math.round((v / goal) * 100);
  return {
    percent,
    barPercent: Math.min(100, percent),
    isOver: v > goal,
    overBy: Math.max(0, Math.round(v - goal)),
    remaining: Math.max(0, Math.round(goal - v)),
  };
}

/**
 * Today's calories out including live (not yet synced) pedometer steps: the
 * tracked total (BMR + workouts + steps, NOT already raised to the TDEE) with
 * its step part replaced by the live step count, then raised to `floor`
 * (the TDEE estimate) if that is higher. Raising first and adding the live
 * steps after would count the steps twice.
 */
export function liveCaloriesOut(input: {
  storedCaloriesOut: number | null;
  storedSteps: number;
  liveSteps: number;
  floor?: number | null;
}): number | null {
  const floor = input.floor && input.floor > 0 ? input.floor : 0;
  if (input.storedCaloriesOut === null) return floor > 0 ? Math.round(floor) : null;
  const steps = Math.max(input.storedSteps, input.liveSteps);
  const live = Math.max(input.storedCaloriesOut, input.storedCaloriesOut - stepCalories(input.storedSteps) + stepCalories(steps));
  return Math.round(Math.max(floor, live));
}
