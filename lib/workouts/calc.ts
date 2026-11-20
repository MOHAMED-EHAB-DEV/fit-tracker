/**
 * Pure workout maths, shared by the server and the live session screen so
 * both always show the same numbers. No database or framework imports.
 */
import type { SetType, TrackingType } from "@/lib/workouts/taxonomy";
import type { PrKind } from "@/lib/workouts/types";

export interface CalcSet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  rpe?: number | null;
  done: boolean;
}

export interface CalcExercise {
  trackingType: TrackingType;
  metValue?: number | null;
  sets: CalcSet[];
}

/** True when a set is ticked AND carries the values its exercise type needs. */
export function isSetLogged(set: CalcSet, trackingType: TrackingType): boolean {
  if (!set.done) return false;
  switch (trackingType) {
    case "weight_reps":
      return (set.reps ?? 0) >= 1 && set.weightKg != null && set.weightKg >= 0;
    case "bodyweight_reps":
      return (set.reps ?? 0) >= 1;
    case "duration":
      return (set.durationSec ?? 0) >= 1;
    case "cardio":
      return (set.durationSec ?? 0) >= 1 || (set.distanceM ?? 0) > 0;
    default:
      return false;
  }
}

/** Weight × reps for one set (0 for time-based sets and unweighted bodyweight sets). */
export function setVolumeKg(set: CalcSet, trackingType: TrackingType): number {
  if (!isSetLogged(set, trackingType)) return 0;
  if (trackingType !== "weight_reps" && trackingType !== "bodyweight_reps") return 0;
  return (set.weightKg ?? 0) * (set.reps ?? 0);
}

export interface SessionTotalsCalc {
  /** Lifted volume of logged non-warm-up sets, in kg. */
  volumeKg: number;
  completedSets: number;
  totalSets: number;
  reps: number;
}

export function computeTotals(exercises: CalcExercise[]): SessionTotalsCalc {
  let volumeKg = 0;
  let completedSets = 0;
  let totalSets = 0;
  let reps = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      totalSets += 1;
      if (!isSetLogged(set, exercise.trackingType)) continue;
      completedSets += 1;
      if (set.type === "warmup") continue;
      volumeKg += setVolumeKg(set, exercise.trackingType);
      reps += set.reps ?? 0;
    }
  }
  return { volumeKg: Math.round(volumeKg * 10) / 10, completedSets, totalSets, reps };
}

/**
 * Estimated one-rep max (Epley). Only meaningful for 1-12 reps; higher-rep
 * sets return null so an endurance set can never register as a strength PR.
 */
export function estimateOneRepMaxKg(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

const DEFAULT_MET = 5;
const SECONDS_PER_SET_ESTIMATE = 150; // work + rest when no duration is known
const MAX_SECONDS_PER_SET = 360;
const MAX_SESSION_SECONDS = 3 * 60 * 60;

/**
 * Active calories for a session (above resting metabolism, so it can be added
 * to BMR without double counting).
 *
 * kcal = (MET - 1) x body weight (kg) x hours. Strength work is mostly rest
 * between sets, so the exercise MET is scaled down to a whole-session value;
 * cardio and timed holds use their MET directly.
 */
export function estimateSessionCalories(input: {
  exercises: CalcExercise[];
  durationSec: number | null | undefined;
  bodyWeightKg: number | null | undefined;
}): number {
  let loggedSets = 0;
  let metWeighted = 0;

  for (const exercise of input.exercises) {
    const rawMet = Number(exercise.metValue);
    const met = Number.isFinite(rawMet) && rawMet >= 1 && rawMet <= 20 ? rawMet : DEFAULT_MET;
    const continuous = exercise.trackingType === "cardio" || exercise.trackingType === "duration";
    const sessionMet = continuous ? met : 1.5 + (met - 1.5) * 0.6;
    for (const set of exercise.sets) {
      if (!isSetLogged(set, exercise.trackingType)) continue;
      loggedSets += 1;
      metWeighted += sessionMet;
    }
  }
  if (loggedSets === 0) return 0;

  const averageMet = Math.min(10, Math.max(2, metWeighted / loggedSets));
  const estimatedSeconds = loggedSets * SECONDS_PER_SET_ESTIMATE;
  const measured = input.durationSec && input.durationSec >= 60 ? input.durationSec : estimatedSeconds;
  // A session left open for hours must not earn hours of calories.
  const seconds = Math.min(measured, loggedSets * MAX_SECONDS_PER_SET + 600, MAX_SESSION_SECONDS);

  const bodyWeightKg = input.bodyWeightKg && input.bodyWeightKg > 0 ? input.bodyWeightKg : 70;
  return Math.max(0, Math.round((averageMet - 1) * bodyWeightKg * (seconds / 3600)));
}

/** Seconds a session should be credited with when its real duration is unknown or implausible. */
export function plausibleDurationSec(durationSec: number | null | undefined, loggedSets: number): number {
  const estimated = Math.max(60, loggedSets * SECONDS_PER_SET_ESTIMATE);
  if (!durationSec || durationSec < 60) return estimated;
  return Math.min(durationSec, 6 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export interface RecordWalkSet extends CalcSet {
  id: string;
}

export interface RecordWalkSession {
  sessionId: string;
  endedAt: Date;
  /** Every block of sets for ONE exercise in this session (it may appear more than once). */
  trackingType: TrackingType;
  sets: RecordWalkSet[];
}

export interface RecordBest {
  kind: PrKind;
  value: number;
  weightKg: number | null;
  reps: number | null;
  sessionId: string;
  achievedAt: Date;
}

/** The record-worthy numbers of one set. */
export function setMetrics(set: CalcSet, trackingType: TrackingType): Partial<Record<PrKind, number>> {
  if (set.type === "warmup" || !isSetLogged(set, trackingType)) return {};
  const metrics: Partial<Record<PrKind, number>> = {};
  if (trackingType === "weight_reps") {
    const weight = set.weightKg ?? 0;
    if (weight > 0) {
      metrics.weight = weight;
      metrics.volume = weight * (set.reps ?? 0);
      const e1rm = estimateOneRepMaxKg(weight, set.reps);
      if (e1rm) metrics.e1rm = e1rm;
    }
  } else if (trackingType === "bodyweight_reps") {
    metrics.reps = set.reps ?? 0;
    if ((set.weightKg ?? 0) > 0) metrics.weight = set.weightKg as number;
  } else if (trackingType === "duration") {
    metrics.duration = set.durationSec ?? 0;
  } else if (trackingType === "cardio") {
    if ((set.durationSec ?? 0) > 0) metrics.duration = set.durationSec as number;
    if ((set.distanceM ?? 0) > 0) metrics.distance = set.distanceM as number;
  }
  return metrics;
}

/**
 * Walks one exercise's history oldest-first and decides which sets were
 * personal records when they happened.
 *
 * Rules: warm-ups never count; the very first session only sets the baseline;
 * in a later session, at most one set per record kind is flagged (the best
 * one), and only when it beats everything before that session.
 */
export function walkExerciseRecords(sessionsOldestFirst: RecordWalkSession[]): {
  prKindsBySetId: Map<string, PrKind[]>;
  bests: RecordBest[];
} {
  const prKindsBySetId = new Map<string, PrKind[]>();
  const best = new Map<PrKind, RecordBest>();

  // Several blocks of the same exercise in one session count as one session.
  const grouped = new Map<string, RecordWalkSession[]>();
  const order: string[] = [];
  for (const entry of sessionsOldestFirst) {
    if (!grouped.has(entry.sessionId)) {
      grouped.set(entry.sessionId, []);
      order.push(entry.sessionId);
    }
    grouped.get(entry.sessionId)!.push(entry);
  }

  let hasHistory = false;
  for (const sessionId of order) {
    const blocks = grouped.get(sessionId)!;
    const sessionBest = new Map<PrKind, { value: number; set: RecordWalkSet }>();

    for (const block of blocks) {
      for (const set of block.sets) {
        const metrics = setMetrics(set, block.trackingType);
        for (const [kind, value] of Object.entries(metrics) as Array<[PrKind, number]>) {
          const current = sessionBest.get(kind);
          if (!current || value > current.value) sessionBest.set(kind, { value, set });
        }
      }
    }
    if (sessionBest.size === 0) continue;

    const endedAt = blocks[0].endedAt;
    for (const [kind, candidate] of sessionBest) {
      const previous = best.get(kind);
      if (hasHistory && previous && candidate.value > previous.value) {
        const kinds = prKindsBySetId.get(candidate.set.id) || [];
        kinds.push(kind);
        prKindsBySetId.set(candidate.set.id, kinds);
      }
      if (!previous || candidate.value > previous.value) {
        best.set(kind, {
          kind,
          value: candidate.value,
          weightKg: candidate.set.weightKg ?? null,
          reps: candidate.set.reps ?? null,
          sessionId,
          achievedAt: endedAt,
        });
      }
    }
    hasHistory = true;
  }

  return { prKindsBySetId, bests: Array.from(best.values()) };
}

/** "1:05:30" / "42:10" style label for a number of seconds. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const two = (value: number) => (value < 10 ? `0${value}` : String(value));
  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}

/** "1h 5m" / "42m" style label. */
export function formatDurationShort(totalSeconds: number | null | undefined): string {
  const minutes = Math.max(0, Math.round((totalSeconds || 0) / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** Rest periods offered in the rest-time menus, in seconds (0 = no timer). */
export const REST_CHOICES_SEC = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300] as const;

/** Exact rest label: "45 s", "2 min", "1 min 30 s", "No rest timer". Never rounded. */
export function formatRestTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds === 0) return "No rest timer";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/** The menu choices, plus the current value when it is not one of them (a custom default from settings). */
export function restChoicesWith(currentSec: number): number[] {
  const choices: number[] = [...REST_CHOICES_SEC];
  if (!choices.includes(currentSec)) choices.push(currentSec);
  return choices.sort((a, b) => a - b);
}
