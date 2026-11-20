import { isValidDateString, weekdayOfDateString } from "@/lib/time";
import { sortEventsByPlannerTime } from "@/lib/planner/time-sort";

/**
 * Which planner events happen on a given calendar day, and whether each one
 * is done that day. Pure and isomorphic: the planner page, the planner API,
 * the dashboard widget and the reminder feed must all agree on this.
 */

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

export interface RecurringFields {
  date: string;
  recurrence?: RecurrenceType | null;
  /** Last day of the series (inclusive). Null/absent = no end. */
  endDate?: string | null;
  excludedDates?: string[] | null;
  completedDates?: string[] | null;
  isCompleted?: boolean | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function splitDate(dateString: string): [number, number, number] {
  const [year, month, day] = dateString.split("-").map(Number);
  return [year, month, day];
}

export function isRecurring(event: Pick<RecurringFields, "recurrence">): boolean {
  return Boolean(event.recurrence && event.recurrence !== "once");
}

/**
 * True when the event takes place on `dateString`.
 * Monthly events created on the 29th-31st fall on the last day of shorter
 * months instead of skipping them.
 */
export function occursOn(event: RecurringFields, dateString: string): boolean {
  if (!isValidDateString(dateString) || !isValidDateString(event.date)) return false;
  if (!isRecurring(event)) return event.date === dateString;

  if (dateString < event.date) return false;
  if (event.endDate && isValidDateString(event.endDate) && dateString > event.endDate) return false;
  if (event.excludedDates?.includes(dateString)) return false;

  switch (event.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return weekdayOfDateString(event.date) === weekdayOfDateString(dateString);
    case "monthly": {
      const [, , startDay] = splitDate(event.date);
      const [year, month, day] = splitDate(dateString);
      const lastDay = daysInMonth(year, month);
      return day === Math.min(startDay, lastDay);
    }
    default:
      return false;
  }
}

/** Whether the event is marked done on `dateString`. */
export function isCompletedOn(event: RecurringFields, dateString: string): boolean {
  if (!isRecurring(event)) return Boolean(event.isCompleted);
  return Array.isArray(event.completedDates) && event.completedDates.includes(dateString);
}

/** The events on `dateString`, each with `isCompleted` for that day, in planner order. */
export function projectEventsForDate<T extends RecurringFields & { startTime: string; title?: string }>(
  events: T[],
  dateString: string
): Array<T & { isCompleted: boolean; occurrenceDate: string }> {
  return sortEventsByPlannerTime(
    events
      .filter((event) => occursOn(event, dateString))
      .map((event) => ({
        ...event,
        isCompleted: isCompletedOn(event, dateString),
        occurrenceDate: dateString,
      }))
  );
}

/** MongoDB filter for every event that could occur on `dateString` (refine with occursOn). */
export function candidateEventsFilter(userId: string, dateString: string): Record<string, unknown> {
  return {
    userId,
    $or: [
      { date: dateString, recurrence: { $in: ["once", null] } },
      {
        date: { $lte: dateString },
        recurrence: { $in: ["daily", "weekly", "monthly"] },
        $and: [{ $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: dateString } }] }],
      },
    ],
  };
}

/**
 * Completion state carried over when an event's recurrence changes while it
 * is viewed on `dateString`, so the day's checkmark survives the edit.
 */
export function completionAfterRecurrenceChange(
  event: RecurringFields,
  nextRecurrence: RecurrenceType,
  dateString: string
): { isCompleted: boolean; completedDates: string[] } {
  const doneThatDay = isCompletedOn(event, dateString);
  if (nextRecurrence === "once") {
    return { isCompleted: doneThatDay, completedDates: [] };
  }
  const dates = new Set(isRecurring(event) ? event.completedDates || [] : []);
  if (doneThatDay) dates.add(dateString);
  return { isCompleted: false, completedDates: Array.from(dates).sort() };
}
