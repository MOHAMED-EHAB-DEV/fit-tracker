/**
 * Day and week helpers used across the app.
 *
 * These are thin wrappers over `lib/time.ts`. Every function takes an optional
 * IANA time zone (the user's `preferences.timezone`); when it is omitted the
 * app default (Africa/Cairo) is used. Nothing here depends on the server's or
 * the device's clock zone.
 */
import {
  DEFAULT_TIMEZONE as APP_DEFAULT_TIMEZONE,
  addDays,
  isValidDateString,
  localDateString,
  normalizeWeekStart,
  weekDatesOf,
  weekStartOf,
} from "@/lib/time";

export const DEFAULT_TIMEZONE = APP_DEFAULT_TIMEZONE;

/** "YYYY-MM-DD" for an instant in the user's time zone. */
export function getTodayDateString(date: Date = new Date(), tz?: string | null): string {
  return localDateString(date, tz);
}

/** First day ("YYYY-MM-DD") of the user's week containing `date`. */
export function getWeekStartDateString(
  date: Date = new Date(),
  tz?: string | null,
  weekStartDay?: string | null
): string {
  return weekStartOf(localDateString(date, tz), normalizeWeekStart(weekStartDay));
}

/** The 7 date strings of a week, from a week-start string or any instant in it. */
export function getWeekDatesStrings(
  dateOrWeekStart: Date | string = new Date(),
  tz?: string | null,
  weekStartDay?: string | null
): string[] {
  if (typeof dateOrWeekStart === "string" && isValidDateString(dateOrWeekStart)) {
    return Array.from({ length: 7 }, (_, index) => addDays(dateOrWeekStart, index));
  }
  const date = typeof dateOrWeekStart === "string" ? new Date(dateOrWeekStart) : dateOrWeekStart;
  return weekDatesOf(localDateString(date, tz), normalizeWeekStart(weekStartDay));
}

/**
 * A stable Date for a calendar day: UTC midnight of the user's local date.
 * Used for `date` fields that sit beside a `dateString`.
 */
export function getDayAnchorDate(date: Date = new Date(), tz?: string | null): Date {
  return new Date(`${localDateString(date, tz)}T00:00:00.000Z`);
}

/** @deprecated Use getDayAnchorDate; kept for existing callers. */
export function getCairoMidnightUTC(date: Date = new Date(), tz?: string | null): Date {
  return getDayAnchorDate(date, tz);
}
