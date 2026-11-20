/** Recurrence matching for "today's plan" (pure). */
import { weekdayOfDateString } from "@/lib/time";

export interface RecurringEventInput {
  /** "YYYY-MM-DD" of the first occurrence. */
  date: string;
  recurrence?: "once" | "daily" | "weekly" | "monthly" | null;
  excludedDates?: string[] | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Whether an event occurs on `dateString`. Monthly events created on the
 * 29th-31st fall on the last day of shorter months (Jan 31 -> Feb 28/29).
 */
export function occursOnDate(event: RecurringEventInput, dateString: string): boolean {
  if (!event.date || dateString < event.date) return false;
  if (event.excludedDates?.includes(dateString)) return false;
  const recurrence = event.recurrence || "once";
  if (recurrence === "once") return event.date === dateString;
  if (recurrence === "daily") return true;
  if (recurrence === "weekly") return weekdayOfDateString(event.date) === weekdayOfDateString(dateString);
  if (recurrence === "monthly") {
    const startDay = Number(event.date.slice(8, 10));
    const year = Number(dateString.slice(0, 4));
    const month = Number(dateString.slice(5, 7));
    const day = Number(dateString.slice(8, 10));
    return day === Math.min(startDay, daysInMonth(year, month));
  }
  return false;
}
