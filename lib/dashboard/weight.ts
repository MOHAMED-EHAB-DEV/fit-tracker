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
