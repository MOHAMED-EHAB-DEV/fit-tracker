import { format, startOfWeek, addDays, parseISO } from "date-fns";

export const DEFAULT_TIMEZONE = "Africa/Cairo";

/**
 * Returns today's date formatted as "YYYY-MM-DD" in the user's timezone.
 */
export function getTodayDateString(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Returns the Saturday start-of-week date string ("YYYY-MM-DD") for any given date.
 * weekStartsOn: 6 represents Saturday in date-fns.
 */
export function getWeekStartDateString(date: Date = new Date()): string {
  const sat = startOfWeek(date, { weekStartsOn: 6 });
  return format(sat, "yyyy-MM-dd");
}

/**
 * Returns an array of 7 date strings ("YYYY-MM-DD") for the active week starting Saturday.
 */
export function getWeekDatesStrings(dateOrWeekStart: Date | string = new Date()): string[] {
  let startDate: Date;
  if (typeof dateOrWeekStart === "string") {
    startDate = parseISO(dateOrWeekStart);
  } else {
    startDate = startOfWeek(dateOrWeekStart, { weekStartsOn: 6 });
  }

  const dateStrings: string[] = [];
  for (let i = 0; i < 7; i++) {
    dateStrings.push(format(addDays(startDate, i), "yyyy-MM-dd"));
  }
  return dateStrings;
}

/**
 * Parses a date or returns the current UTC midnight representation of Cairo time.
 */
export function getCairoMidnightUTC(date: Date = new Date()): Date {
  const dateStr = getTodayDateString(date);
  return new Date(`${dateStr}T00:00:00.000Z`);
}
