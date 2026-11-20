import { localDateString, localParts, zonedTimeToUtc } from "@/lib/time";
import { defaultTimeForMealType } from "@/lib/nutrition/totals";
import type { MealType } from "@/types/fitness";

const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

/** "HH:MM" of an instant in the given zone. */
export function localTimeString(date: Date, tz?: string | null): string {
  const p = localParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The instant a meal was eaten.
 *  - explicit time: that wall-clock time on `dateString` in the user's zone;
 *  - no time, today: now;
 *  - no time, another day: a typical time for the meal type.
 */
export function resolveLoggedAt(
  dateString: string,
  time: string | undefined,
  mealType: MealType,
  tz: string | null | undefined,
  now: Date = new Date()
): Date {
  if (time) return zonedTimeToUtc(dateString, time, tz);
  if (localDateString(now, tz) === dateString) return now;
  return zonedTimeToUtc(dateString, defaultTimeForMealType(mealType), tz);
}

/**
 * The time to show in an edit form. Older meals logged for a past day carry the
 * moment they were typed in; when that instant is not on the meal's own day,
 * a typical time for the meal type is shown instead.
 */
export function mealTimeForForm(
  loggedAt: Date | string | undefined,
  dateString: string,
  mealType: MealType,
  tz?: string | null
): string {
  const instant = loggedAt ? new Date(loggedAt) : null;
  if (instant && !Number.isNaN(instant.getTime()) && localDateString(instant, tz) === dateString) {
    return localTimeString(instant, tz);
  }
  return defaultTimeForMealType(mealType);
}

/** True when the instant falls on the meal's own day in the user's zone. */
export function isLoggedOnMealDay(loggedAt: Date | string | undefined, dateString: string, tz?: string | null): boolean {
  if (!loggedAt) return false;
  const instant = new Date(loggedAt);
  return !Number.isNaN(instant.getTime()) && localDateString(instant, tz) === dateString;
}

/** The earliest day meals can be logged for or browsed to. */
export const EARLIEST_LOG_DATE = "2000-01-01";
