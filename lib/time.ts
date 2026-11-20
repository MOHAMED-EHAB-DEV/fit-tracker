/**
 * Time-zone aware calendar helpers.
 *
 * Every "day" in the app (today, week boundaries, a workout's date) is a
 * calendar date in the USER's IANA time zone — never the server's clock zone
 * (UTC on Vercel) and never the device's zone on its own. These helpers are
 * isomorphic: the same code runs on the server and in the browser, so both
 * sides always agree on what "today" is.
 */

export const DEFAULT_TIMEZONE = "Africa/Cairo";

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const DATE_STRING_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `tz` is an IANA zone this runtime understands. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Returns a usable IANA zone, falling back to the app default. */
export function resolveTimeZone(tz?: string | null): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** The browser's zone (client only); falls back to the app default. */
export function detectDeviceTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: WeekdayKey;
}

/** Wall-clock parts of an instant in the given zone. */
export function localParts(date: Date = new Date(), tz?: string | null): LocalParts {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = getFormatter(resolveTimeZone(tz)).formatToParts(safeDate);
  const lookup: Record<string, string> = {};
  for (const part of parts) lookup[part.type] = part.value;
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: (lookup.weekday || "sunday").toLowerCase() as WeekdayKey,
  };
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** "YYYY-MM-DD" for an instant, in the given zone. */
export function localDateString(date: Date = new Date(), tz?: string | null): string {
  const p = localParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Weekday key ("saturday", ...) for an instant, in the given zone. */
export function localWeekdayKey(date: Date = new Date(), tz?: string | null): WeekdayKey {
  return localParts(date, tz).weekday;
}

/** True for a real calendar date written as "YYYY-MM-DD" (rejects 2026-02-31). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_STRING_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function dateStringToUtcNoon(dateString: string): Date {
  const match = DATE_STRING_RE.exec(dateString);
  if (!match) return new Date(NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

/** Calendar arithmetic on a date string (zone independent). */
export function addDays(dateString: string, days: number): string {
  const base = dateStringToUtcNoon(dateString);
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = dateStringToUtcNoon(from).getTime();
  const b = dateStringToUtcNoon(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Weekday key of a calendar date string. */
export function weekdayOfDateString(dateString: string): WeekdayKey {
  return WEEKDAY_KEYS[dateStringToUtcNoon(dateString).getUTCDay()];
}

/** First day ("YYYY-MM-DD") of the week containing `dateString`. */
export function weekStartOf(dateString: string, weekStart: WeekdayKey = "saturday"): string {
  const current = WEEKDAY_KEYS.indexOf(weekdayOfDateString(dateString));
  const start = WEEKDAY_KEYS.indexOf(weekStart);
  const offset = (current - start + 7) % 7;
  return addDays(dateString, -offset);
}

/** The 7 date strings of the week containing `dateString`. */
export function weekDatesOf(dateString: string, weekStart: WeekdayKey = "saturday"): string[] {
  const first = weekStartOf(dateString, weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Weekday keys in display order for the given week start. */
export function orderedWeekdays(weekStart: WeekdayKey = "saturday"): WeekdayKey[] {
  const start = WEEKDAY_KEYS.indexOf(weekStart);
  return Array.from({ length: 7 }, (_, index) => WEEKDAY_KEYS[(start + index) % 7]);
}

export function normalizeWeekStart(value?: string | null): WeekdayKey {
  const lower = (value || "").toLowerCase();
  return (WEEKDAY_KEYS as readonly string[]).includes(lower) ? (lower as WeekdayKey) : "saturday";
}

/**
 * The UTC instant of a wall-clock time in a zone, e.g. local midnight.
 * Handles DST by re-checking the offset at the candidate instant.
 */
export function zonedTimeToUtc(dateString: string, time: string = "00:00", tz?: string | null): Date {
  const match = DATE_STRING_RE.exec(dateString);
  if (!match) return new Date(NaN);
  const [hourText = "0", minuteText = "0"] = time.split(":");
  const hour = Number(hourText) || 0;
  const minute = Number(minuteText) || 0;
  const zone = resolveTimeZone(tz);
  const wallAsUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute);

  const offsetAt = (instant: number): number => {
    const p = localParts(new Date(instant), zone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
  };

  const first = wallAsUtc - offsetAt(wallAsUtc);
  const second = wallAsUtc - offsetAt(first);
  const shows = (instant: number): boolean => {
    const p = localParts(new Date(instant), zone);
    return p.day === Number(match[3]) && p.hour === hour && p.minute === minute;
  };
  if (shows(second)) return new Date(second);
  if (shows(first)) return new Date(first);
  // The wall time does not exist (the clocks jump forward over it): use the
  // moment after the jump, as calendars do, in every time zone.
  return new Date(Math.max(first, second));
}

/** [start, end) UTC instants covering one local calendar day. */
export function localDayRangeUtc(dateString: string, tz?: string | null): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(dateString, "00:00", tz),
    end: zonedTimeToUtc(addDays(dateString, 1), "00:00", tz),
  };
}

/** Human label such as "Thu, Nov 19" for a date string. */
export function formatDateString(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" },
  locale: string = "en-US"
): string {
  const date = dateStringToUtcNoon(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

/** Clock label such as "6:40 PM" for an instant, in the given zone. */
export function formatTimeInZone(date: Date | string, tz?: string | null, locale: string = "en-US"): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(instant.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: resolveTimeZone(tz),
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}
