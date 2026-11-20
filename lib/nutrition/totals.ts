import type { MealType } from "@/types/fitness";

/** Pure nutrition maths shared by the server and the client. */

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const MACRO_KEYS = ["calories", "protein", "carbs", "fat", "fiber"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const finite = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const round1 = (value: number): number => Math.round(finite(value) * 10) / 10;

/** Whole kcal, grams to one decimal, never negative. */
export function roundMacros(m: Partial<Macros>): Macros {
  return {
    calories: Math.max(0, Math.round(finite(m.calories))),
    protein: Math.max(0, round1(finite(m.protein))),
    carbs: Math.max(0, round1(finite(m.carbs))),
    fat: Math.max(0, round1(finite(m.fat))),
    fiber: Math.max(0, round1(finite(m.fiber))),
  };
}

/** Sum of several items/meals, rounded once at the end (no drift). */
export function sumMacros(list: ReadonlyArray<Partial<Macros>>): Macros {
  const total = { ...ZERO_MACROS };
  for (const entry of list) {
    for (const key of MACRO_KEYS) total[key] += Math.max(0, finite(entry[key]));
  }
  return roundMacros(total);
}

/** True when two macro sets differ by more than rounding noise. */
export function macrosDiffer(a: Partial<Macros>, b: Partial<Macros>): boolean {
  const x = roundMacros(a);
  const y = roundMacros(b);
  return (
    Math.abs(x.calories - y.calories) >= 1 ||
    Math.abs(x.protein - y.protein) >= 0.1 ||
    Math.abs(x.carbs - y.carbs) >= 0.1 ||
    Math.abs(x.fat - y.fat) >= 0.1 ||
    Math.abs(x.fiber - y.fiber) >= 0.1
  );
}

export interface EnergySplit {
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  macroKcal: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/** Share of energy from each macro; null when there is nothing to split. */
export function energySplit(m: Partial<Macros>): EnergySplit | null {
  const proteinKcal = Math.max(0, finite(m.protein)) * 4;
  const carbsKcal = Math.max(0, finite(m.carbs)) * 4;
  const fatKcal = Math.max(0, finite(m.fat)) * 9;
  const macroKcal = proteinKcal + carbsKcal + fatKcal;
  if (macroKcal <= 0) return null;
  const proteinPct = Math.round((proteinKcal / macroKcal) * 100);
  const carbsPct = Math.round((carbsKcal / macroKcal) * 100);
  return {
    proteinKcal: Math.round(proteinKcal),
    carbsKcal: Math.round(carbsKcal),
    fatKcal: Math.round(fatKcal),
    macroKcal: Math.round(macroKcal),
    proteinPct,
    carbsPct,
    fatPct: Math.max(0, 100 - proteinPct - carbsPct),
  };
}

export type MacroGoalKind = "limit" | "minimum";
export type MacroGoalState = "no_target" | "under" | "met" | "over";

export interface MacroGoalStatus {
  state: MacroGoalState;
  /** Whole percent of target; null without a target. */
  percent: number | null;
  /** target - consumed (negative when over). */
  remaining: number;
}

/**
 * Where a day stands against one target.
 *  - "limit" (calories, carbs, fat): met within 95-110 %, over above 110 %.
 *  - "minimum" (protein, fiber): met from 95 % up; going over is fine.
 */
export function macroGoalStatus(consumed: number, target: number, kind: MacroGoalKind): MacroGoalStatus {
  const eaten = Math.max(0, finite(consumed));
  const goal = finite(target);
  if (goal <= 0) return { state: "no_target", percent: null, remaining: 0 };
  const ratio = eaten / goal;
  const percent = Math.round(ratio * 100);
  const remaining = goal - eaten;
  if (ratio < 0.95) return { state: "under", percent, remaining };
  if (kind === "limit" && ratio > 1.1) return { state: "over", percent, remaining };
  return { state: "met", percent, remaining };
}

/** A sensible meal type for a local hour of day (0-23). */
export function defaultMealTypeForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 18 && hour < 22) return "dinner";
  return "snack";
}

/** A typical local time for a meal type, used when logging a past day. */
export function defaultTimeForMealType(type: MealType): string {
  switch (type) {
    case "breakfast":
      return "08:00";
    case "lunch":
      return "13:00";
    case "dinner":
      return "19:30";
    case "pre_workout":
      return "17:00";
    case "post_workout":
      return "19:00";
    default:
      return "16:00";
  }
}

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** Locale-independent number label (same output on server and device). */
export function formatAmount(value: number): string {
  return NUMBER_FORMAT.format(finite(value));
}
