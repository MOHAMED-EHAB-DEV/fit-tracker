/**
 * 7-day energy series for the dashboard (pure, no database).
 *
 * Calories Out for a day = max(TDEE, BMR + tracked workouts + tracked steps).
 * TDEE already contains the user's typical activity; tracked activity only
 * replaces it on days where it is higher. This keeps "out" on the same model
 * as the TDEE-based calorie target (a maintain user who eats their target
 * sees a balance near zero, not a daily "surplus").
 *
 * Days in the future, days without a log, and days where no food was logged
 * have `null` values; they are never drawn and never averaged.
 */
import { formatDateString } from "@/lib/time";

export interface EnergyLogInput {
  dateString: string;
  caloriesIn?: number | null;
  caloriesOut?: { bmr?: number | null; workouts?: number | null; steps?: number | null; total?: number | null } | null;
  macros?: { protein?: number | null; carbs?: number | null; fat?: number | null } | null;
  steps?: number | null;
}

export interface EnergyDay {
  dateString: string;
  /** "Sat". */
  dayLabel: string;
  /** "Sat, Nov 14". */
  fullDateLabel: string;
  isToday: boolean;
  isFuture: boolean;
  /** Food was logged that day. */
  hasFoodData: boolean;
  caloriesIn: number | null;
  caloriesOut: number | null;
  /** caloriesIn - caloriesOut, when both are known. */
  net: number | null;
  targetCalories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  steps: number | null;
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Daily expenditure on the TDEE model (see file comment); null when nothing is known. */
export function dailyCaloriesOut(log: EnergyLogInput | null | undefined, bmr: number | null, tdee: number | null): number | null {
  const best = Math.max(tdee && tdee > 0 ? tdee : 0, trackedCaloriesOut(log, bmr) ?? 0);
  return best > 0 ? Math.round(best) : null;
}

/** What the day's log adds up to (BMR + workouts + steps), or the BMR alone; not raised to the TDEE. */
export function trackedCaloriesOut(log: EnergyLogInput | null | undefined, bmr: number | null): number | null {
  const out = log?.caloriesOut;
  const tracked = out
    ? num(out.total) || num(out.bmr) + num(out.workouts) + num(out.steps)
    : 0;
  const trackedOrBmr = tracked > 0 ? tracked : bmr && bmr > 0 ? bmr : 0;
  return trackedOrBmr > 0 ? Math.round(trackedOrBmr) : null;
}

export function buildEnergySeries(input: {
  /** The 7 dates of the week in display order. */
  weekDates: string[];
  todayDateString: string;
  logs: EnergyLogInput[];
  bmr: number | null;
  tdee: number | null;
  targetCalories: number | null;
}): EnergyDay[] {
  const byDate = new Map(input.logs.map((log) => [log.dateString, log]));
  return input.weekDates.map((dateString) => {
    const isFuture = dateString > input.todayDateString;
    const log = isFuture ? undefined : byDate.get(dateString);
    const caloriesIn = log ? num(log.caloriesIn) : 0;
    const hasFoodData = caloriesIn > 0;
    const caloriesOut = log ? dailyCaloriesOut(log, input.bmr, input.tdee) : null;
    const inValue = hasFoodData ? Math.round(caloriesIn) : null;
    return {
      dateString,
      dayLabel: formatDateString(dateString, { weekday: "short" }),
      fullDateLabel: formatDateString(dateString, { weekday: "short", month: "short", day: "numeric" }),
      isToday: dateString === input.todayDateString,
      isFuture,
      hasFoodData,
      caloriesIn: inValue,
      caloriesOut,
      net: inValue !== null && caloriesOut !== null ? inValue - caloriesOut : null,
      targetCalories: input.targetCalories,
      protein: hasFoodData ? Math.round(num(log?.macros?.protein) * 10) / 10 : null,
      carbs: hasFoodData ? Math.round(num(log?.macros?.carbs) * 10) / 10 : null,
      fat: hasFoodData ? Math.round(num(log?.macros?.fat) * 10) / 10 : null,
      steps: log ? Math.round(num(log.steps)) : null,
    };
  });
}

export interface EnergySummary {
  /** Days included in the averages and the net balance. */
  daysCounted: number;
  /** Whether today's (still running) day is part of the numbers. */
  includesToday: boolean;
  avgIn: number | null;
  avgOut: number | null;
  /** Sum of daily (in - out) over the counted days. */
  net: number | null;
  /** net / daysCounted. */
  avgNet: number | null;
}

/**
 * Totals over finished days with food logged. Today is used only when no
 * finished day has data yet (a half-eaten day would look like a deficit).
 */
export function summarizeEnergy(series: EnergyDay[]): EnergySummary {
  const usable = series.filter((d) => !d.isFuture && d.net !== null);
  const finished = usable.filter((d) => !d.isToday);
  const counted = finished.length > 0 ? finished : usable;
  if (counted.length === 0) {
    return { daysCounted: 0, includesToday: false, avgIn: null, avgOut: null, net: null, avgNet: null };
  }
  const totalIn = counted.reduce((sum, d) => sum + (d.caloriesIn ?? 0), 0);
  const totalOut = counted.reduce((sum, d) => sum + (d.caloriesOut ?? 0), 0);
  const net = totalIn - totalOut;
  return {
    daysCounted: counted.length,
    includesToday: counted.some((d) => d.isToday),
    avgIn: Math.round(totalIn / counted.length),
    avgOut: Math.round(totalOut / counted.length),
    net,
    avgNet: Math.round(net / counted.length),
  };
}

export type Goal = "cut" | "maintain" | "bulk";

/** Whether an average daily balance moves the user towards their goal. */
export function balanceTone(avgNet: number | null, goal: Goal | null | undefined): "good" | "off" | "neutral" {
  if (avgNet === null) return "neutral";
  if (goal === "cut") return avgNet < 0 ? "good" : "off";
  if (goal === "bulk") return avgNet > 0 ? "good" : "off";
  return Math.abs(avgNet) <= 200 ? "good" : "off";
}

/**
 * "Fat loss (−450 kcal/day)" etc. The offset is the user's real one: calorie
 * target minus TDEE (covers both the goal adjustment and a custom target).
 */
export function goalLabel(
  goal: Goal | null | undefined,
  targetCalories: number | null | undefined,
  tdee: number | null | undefined
): string {
  const adj =
    typeof targetCalories === "number" && typeof tdee === "number" && targetCalories > 0 && tdee > 0
      ? Math.round(targetCalories - tdee)
      : null;
  const signed = adj === null || adj === 0 ? "" : ` (${adj > 0 ? "+" : "−"}${Math.abs(adj)} kcal/day)`;
  if (goal === "cut") return `Fat loss${signed}`;
  if (goal === "bulk") return `Muscle gain${signed}`;
  if (goal === "maintain") return "Maintenance";
  return "No goal set";
}
