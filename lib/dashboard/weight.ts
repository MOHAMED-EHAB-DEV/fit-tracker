/** Weight-trend data for the dashboard (pure, no database). Values in kg. */

export interface WeightCheckInInput {
  checkInDate: Date | string;
  dateString?: string | null;
  weight?: number | null;
  bodyFatPercent?: number | null;
}

export interface WeightPoint {
  /** "YYYY-MM-DD" in the user's zone (falls back to the UTC date of checkInDate). */
  dateString: string;
  /** Epoch ms of the check-in; the chart's x axis uses real time. */
  timestamp: number;
  weightKg: number;
  bodyFatPercent: number | null;
}

export const DEFAULT_WEIGHT_HISTORY_POINTS = 30;

/**
 * The newest `limit` weigh-ins, oldest first for drawing. Entries without a
 * plausible weight are skipped. Works on any order of input.
 */
export function buildWeightHistory(
  checkIns: WeightCheckInInput[],
  limit: number = DEFAULT_WEIGHT_HISTORY_POINTS
): WeightPoint[] {
  const points: WeightPoint[] = [];
  for (const c of checkIns) {
    const weight = c.weight;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 20 || weight > 400) continue;
    const date = c.checkInDate instanceof Date ? c.checkInDate : new Date(c.checkInDate);
    const timestamp = date.getTime();
    if (Number.isNaN(timestamp)) continue;
    const bf = c.bodyFatPercent;
    points.push({
      dateString: c.dateString || date.toISOString().slice(0, 10),
      timestamp,
      weightKg: weight,
      bodyFatPercent: typeof bf === "number" && Number.isFinite(bf) ? bf : null,
    });
  }
  points.sort((a, b) => a.timestamp - b.timestamp);
  return points.slice(-Math.max(1, limit));
}

export interface WeightChange {
  firstKg: number;
  lastKg: number;
  deltaKg: number;
  days: number;
}

/** Change from the first to the last point; null with fewer than two points. */
export function weightChange(history: WeightPoint[]): WeightChange | null {
  if (history.length < 2) return null;
  const first = history[0];
  const last = history[history.length - 1];
  return {
    firstKg: first.weightKg,
    lastKg: last.weightKg,
    deltaKg: Math.round((last.weightKg - first.weightKg) * 10) / 10,
    days: Math.max(0, Math.round((last.timestamp - first.timestamp) / 86_400_000)),
  };
}

/** Whether a weight change moves the user towards their goal. */
export function weightChangeTone(
  deltaKg: number,
  goal: "cut" | "maintain" | "bulk" | null | undefined
): "good" | "off" | "neutral" {
  if (Math.abs(deltaKg) < 0.05) return "neutral";
  if (goal === "cut") return deltaKg < 0 ? "good" : "off";
  if (goal === "bulk") return deltaKg > 0 ? "good" : "off";
  if (goal === "maintain") return Math.abs(deltaKg) <= 1 ? "good" : "off";
  return "neutral";
}

const DAY_MS = 86_400_000;

/**
 * The trailing average for every weigh-in: the mean of all weigh-ins in the
 * `windowDays` days up to and including it (a 7-day average smooths daily
 * water swings). Input in any order; output in the same order as the input.
 */
export function movingAverage(points: ReadonlyArray<{ timestamp: number; weightKg: number }>, windowDays: number = 7): number[] {
  const windowMs = Math.max(1, windowDays) * DAY_MS;
  return points.map((point) => {
    let sum = 0;
    let count = 0;
    for (const other of points) {
      if (other.timestamp <= point.timestamp && other.timestamp > point.timestamp - windowMs) {
        sum += other.weightKg;
        count += 1;
      }
    }
    return count > 0 ? Math.round((sum / count) * 100) / 100 : point.weightKg;
  });
}

/** Weigh-ins of the last `days` days up to `nowMs`, oldest first. */
export function pointsWithinDays<T extends { timestamp: number }>(points: readonly T[], days: number, nowMs: number): T[] {
  const from = nowMs - days * DAY_MS;
  return points.filter((point) => point.timestamp >= from && point.timestamp <= nowMs).sort((a, b) => a.timestamp - b.timestamp);
}
