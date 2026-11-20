import { addDays, daysBetween, isValidDateString, zonedTimeToUtc } from "@/lib/time";
import { PLANNER_DAY_START_HOUR } from "@/lib/planner/time-sort";

/**
 * Pure planner-reminder expansion: turns planned events (with recurrence)
 * into concrete occurrences on given calendar days, as exact UTC instants in
 * the user's time zone. No database or framework code here.
 */

export type ReminderRecurrence = "once" | "daily" | "weekly" | "monthly";

export interface ReminderEventInput {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  /** First day of the event, "YYYY-MM-DD". */
  date: string;
  /** Last day of a repeating series (inclusive); absent = no end. */
  endDate?: string | null;
  /** "HH:MM" (24h). Events without a valid time get no reminder. */
  startTime?: string | null;
  recurrence?: string | null;
  excludedDates?: readonly string[] | null;
  completedDates?: readonly string[] | null;
  isCompleted?: boolean | null;
}

export interface ReminderOccurrence {
  /** Stable per occurrence: `${eventId}:${date}`. */
  key: string;
  eventId: string;
  title: string;
  description: string;
  category: string;
  date: string;
  startTime: string;
  /** ISO instant the event starts. */
  startsAt: string;
  /** ISO instant the reminder should fire (startsAt minus the lead time). */
  notifyAt: string;
  startsAtMs: number;
  notifyAtMs: number;
}

export interface ExpandOptions {
  /** Calendar days to expand, "YYYY-MM-DD" in the user's zone. */
  dates: readonly string[];
  timeZone: string;
  /** Occurrences that already started before this instant are dropped. */
  now: Date;
  /** Minutes before the start at which to remind. */
  leadMinutes: number;
}

export const REMINDER_TITLE_MAX = 120;
export const REMINDER_DESCRIPTION_MAX = 300;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidStartTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

function normalizeRecurrence(value: string | null | undefined): ReminderRecurrence | null {
  if (value === undefined || value === null || value === "" || value === "once") return "once";
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  return null;
}

function dayOfMonth(dateString: string): number {
  return Number(dateString.slice(8, 10));
}

function daysInMonthOf(dateString: string): number {
  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * True when the event has an occurrence on `day`. A monthly event that starts
 * on the 29th-31st falls on the last day of shorter months.
 */
export function occursOn(event: ReminderEventInput, day: string): boolean {
  if (!isValidDateString(event.date) || !isValidDateString(day)) return false;
  const recurrence = normalizeRecurrence(event.recurrence);
  if (!recurrence) return false;
  if (day < event.date) return false;
  // "Delete this and following days" ends a series.
  if (recurrence !== "once" && event.endDate && isValidDateString(event.endDate) && day > event.endDate) return false;

  switch (recurrence) {
    case "once":
      return day === event.date;
    case "daily":
      return true;
    case "weekly":
      return daysBetween(event.date, day) % 7 === 0;
    case "monthly": {
      const startDay = dayOfMonth(event.date);
      const lastDay = daysInMonthOf(day);
      return dayOfMonth(day) === Math.min(startDay, lastDay);
    }
  }
}

/** True when the occurrence on `day` was completed or removed by the user. */
export function isSkippedOn(event: ReminderEventInput, day: string): boolean {
  if (event.excludedDates?.includes(day)) return true;
  const recurrence = normalizeRecurrence(event.recurrence);
  if (recurrence === "once") return Boolean(event.isCompleted) || Boolean(event.completedDates?.includes(day));
  return Boolean(event.completedDates?.includes(day));
}

function clip(text: string | null | undefined, max: number): string {
  const value = (text || "").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** All reminder occurrences on the given days that have not started yet, sorted by start. */
export function expandOccurrences(
  events: readonly ReminderEventInput[],
  options: ExpandOptions
): ReminderOccurrence[] {
  const nowMs = options.now.getTime();
  const leadMs = Math.max(0, Math.round(options.leadMinutes)) * 60_000;
  const days = Array.from(new Set(options.dates.filter((day) => isValidDateString(day))));
  const result: ReminderOccurrence[] = [];

  for (const event of events) {
    if (!event.id || !isValidStartTime(event.startTime)) continue;
    const title = clip(event.title, REMINDER_TITLE_MAX);
    if (!title) continue;

    for (const day of days) {
      if (!occursOn(event, day) || isSkippedOn(event, day)) continue;
      // A planner day runs 05:00-04:59 (lib/planner/time-sort.ts): a 00:30
      // block on Monday's plan happens early on Tuesday.
      const wallDay = Number(event.startTime.slice(0, 2)) < PLANNER_DAY_START_HOUR ? addDays(day, 1) : day;
      const starts = zonedTimeToUtc(wallDay, event.startTime, options.timeZone);
      const startsAtMs = starts.getTime();
      if (Number.isNaN(startsAtMs) || startsAtMs <= nowMs) continue;
      const notifyAtMs = startsAtMs - leadMs;

      result.push({
        key: `${event.id}:${day}`,
        eventId: event.id,
        title,
        description: clip(event.description, REMINDER_DESCRIPTION_MAX),
        category: event.category || "other",
        date: day,
        startTime: event.startTime,
        startsAt: starts.toISOString(),
        notifyAt: new Date(notifyAtMs).toISOString(),
        startsAtMs,
        notifyAtMs,
      });
    }
  }

  return result.sort((a, b) => a.startsAtMs - b.startsAtMs || a.key.localeCompare(b.key));
}

/** The user's today and tomorrow. */
export function reminderWindowDates(today: string): string[] {
  return [today, addDays(today, 1)];
}
