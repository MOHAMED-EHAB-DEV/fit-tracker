/**
 * The trend line in an exercise's detail: one value per workout, oldest
 * first, measured the way that suits the exercise.
 */
import { fromKg, type WeightUnit } from "@/lib/fitness/units";
import type { TrackingType } from "@/lib/workouts/taxonomy";

export type ProgressMetric = "e1rm" | "reps" | "duration" | "distance";

export interface ProgressPoint {
  /** "YYYY-MM-DD" of the workout. */
  date: string;
  /** In the display unit: kg / lbs, reps, seconds or kilometres. */
  value: number;
}

export interface ExerciseProgress {
  metric: ProgressMetric;
  /** "Estimated 1-rep max", "Most reps", ... */
  label: string;
  points: ProgressPoint[];
}

/** The part of an exercise-history entry the trend needs (newest first, as the API returns it). */
export interface ProgressSource {
  localDate: string;
  bestE1rmKg: number | null;
  sets: ReadonlyArray<{ type: string; reps: number | null; durationSec: number | null; distanceM: number | null }>;
}

const LABELS: Record<ProgressMetric, string> = {
  e1rm: "Estimated 1-rep max",
  reps: "Most reps in a set",
  duration: "Longest set",
  distance: "Longest distance",
};

function bestOf(entry: ProgressSource, pick: (set: ProgressSource["sets"][number]) => number | null): number | null {
  let best: number | null = null;
  for (const set of entry.sets) {
    if (set.type === "warmup") continue;
    const value = pick(set);
    if (value !== null && value > 0 && (best === null || value > best)) best = value;
  }
  return best;
}

/**
 * Picks the measure for the exercise and returns one point per workout,
 * oldest first. Weighted lifts use the estimated 1-rep max (in the user's
 * unit), bodyweight exercises the most reps, timed ones the longest set,
 * cardio the longest distance (or time when no distance was logged).
 */
export function exerciseProgress(
  history: readonly ProgressSource[],
  trackingType: TrackingType,
  unit: WeightUnit
): ExerciseProgress {
  let metric: ProgressMetric;
  if (trackingType === "weight_reps") metric = "e1rm";
  else if (trackingType === "bodyweight_reps") metric = "reps";
  else if (trackingType === "duration") metric = "duration";
  else metric = history.some((entry) => bestOf(entry, (set) => set.distanceM) !== null) ? "distance" : "duration";

  const points: ProgressPoint[] = [];
  for (const entry of [...history].reverse()) {
    let value: number | null;
    switch (metric) {
      case "e1rm":
        value = entry.bestE1rmKg && entry.bestE1rmKg > 0 ? fromKg(entry.bestE1rmKg, unit) : null;
        break;
      case "reps":
        value = bestOf(entry, (set) => set.reps);
        break;
      case "duration":
        value = bestOf(entry, (set) => set.durationSec);
        break;
      case "distance": {
        const metres = bestOf(entry, (set) => set.distanceM);
        value = metres === null ? null : Math.round(metres / 10) / 100;
        break;
      }
    }
    if (value !== null) points.push({ date: entry.localDate, value });
  }

  return { metric, label: LABELS[metric], points };
}
