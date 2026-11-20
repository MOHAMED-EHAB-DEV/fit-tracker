import { addDays, daysBetween } from "@/lib/time";
import { isSetLogged, estimateOneRepMaxKg, type CalcExercise, type CalcSet } from "@/lib/workouts/calc";

/**
 * The numbers the AI coach is given about the user. Pure, so each one can be
 * tested: windows are exact, today's partial day never skews an average,
 * warm-ups never count as volume, and missing data stays missing.
 */

/** First day of a window of `days` calendar days ending today (inclusive). */
export function windowStart(today: string, days: number): string {
  return addDays(today, -(Math.max(1, Math.round(days)) - 1));
}

export interface WeighIn {
  date: string;
  weightKg: number | null | undefined;
}

export interface WeightTrend {
  startDate: string;
  endDate: string;
  startKg: number;
  endKg: number;
  deltaKg: number;
  /** Days between the first and last weigh-in. */
  spanDays: number;
  /** kg per week over the weigh-in span; null when the span is under 7 days. */
  weeklyRateKg: number | null;
  count: number;
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Trend across weigh-ins that actually have a weight; null with fewer than two. */
export function weightTrend(checkIns: WeighIn[]): WeightTrend | null {
  const weighted = checkIns
    .filter((c): c is { date: string; weightKg: number } => typeof c.weightKg === "number" && c.weightKg > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (weighted.length < 2) return null;
  const first = weighted[0];
  const last = weighted[weighted.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  const deltaKg = round(last.weightKg - first.weightKg, 2);
  return {
    startDate: first.date,
    endDate: last.date,
    startKg: first.weightKg,
    endKg: last.weightKg,
    deltaKg,
    spanDays,
    weeklyRateKg: spanDays >= 7 ? round(deltaKg / (spanDays / 7), 2) : null,
    count: weighted.length,
  };
}

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
}

export interface NutritionStats {
  /** Completed days in the window (today excluded). */
  completeDays: number;
  /** Completed days with at least one meal logged. */
  loggedDays: number;
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  /** Logged days within ±10% of the calorie target; null without a target. */
  calorieHitDays: number | null;
  /** Logged days at or above 90% of the protein target; null without a target. */
  proteinHitDays: number | null;
}

export function nutritionStats(
  days: DayTotals[],
  window: { start: string; today: string },
  targets: { calories: number | null; protein: number | null }
): NutritionStats {
  const complete = days.filter((day) => day.date >= window.start && day.date < window.today && day.meals > 0);
  const completeDays = Math.max(0, daysBetween(window.start, window.today));
  const n = complete.length;
  const avg = (pick: (day: DayTotals) => number) => (n ? Math.round(complete.reduce((s, d) => s + pick(d), 0) / n) : null);
  return {
    completeDays,
    loggedDays: n,
    avgCalories: avg((d) => d.calories),
    avgProtein: avg((d) => d.protein),
    avgCarbs: avg((d) => d.carbs),
    avgFat: avg((d) => d.fat),
    calorieHitDays: targets.calories
      ? complete.filter((d) => Math.abs(d.calories - targets.calories!) <= targets.calories! * 0.1).length
      : null,
    proteinHitDays: targets.protein ? complete.filter((d) => d.protein >= targets.protein! * 0.9).length : null,
  };
}

export interface ContextSessionExercise extends CalcExercise {
  name: string;
  muscleGroup?: string | null;
  sets: Array<CalcSet & { prKinds?: string[] }>;
}

export interface ContextSession {
  localDate: string;
  name: string;
  durationSec: number | null;
  volumeKg: number;
  exercises: ContextSessionExercise[];
}

/** Logged working sets (warm-ups excluded) per muscle group. */
export function workingSetsByMuscle(sessions: ContextSession[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const group = exercise.muscleGroup || "other";
      const sets = exercise.sets.filter((set) => set.type !== "warmup" && isSetLogged(set, exercise.trackingType)).length;
      if (sets > 0) counts[group] = (counts[group] || 0) + sets;
    }
  }
  return counts;
}

/** Sets per week for a window of `days` days. */
export function perWeek(count: number, days: number): number {
  return round(count / (Math.max(1, days) / 7), 1);
}

export interface TopSet {
  exercise: string;
  weightKg: number;
  reps: number;
  e1rmKg: number | null;
  date: string;
  isPr: boolean;
}

/** Heaviest logged working set per exercise in the sessions given (oldest first in, best last wins ties). */
export function topSetsByExercise(sessions: ContextSession[]): TopSet[] {
  const best = new Map<string, TopSet>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.trackingType !== "weight_reps") continue;
      for (const set of exercise.sets) {
        if (set.type === "warmup" || !isSetLogged(set, exercise.trackingType)) continue;
        const weightKg = set.weightKg ?? 0;
        const reps = set.reps ?? 0;
        const current = best.get(exercise.name);
        if (!current || weightKg > current.weightKg || (weightKg === current.weightKg && reps > current.reps)) {
          best.set(exercise.name, {
            exercise: exercise.name,
            weightKg,
            reps,
            e1rmKg: estimateOneRepMaxKg(weightKg, reps),
            date: session.localDate,
            isPr: Boolean(set.prKinds && set.prKinds.length > 0),
          });
        }
      }
    }
  }
  return Array.from(best.values());
}

/** Average of a list, or null when empty. */
export function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}
