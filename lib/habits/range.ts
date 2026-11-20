import { addDays, daysBetween, formatDateString, orderedWeekdays, weekStartOf, type WeekdayKey } from "@/lib/time";

export type HabitViewMode = "week" | "month";

export interface HabitRangeDay {
  dateString: string;
  /** Short axis label: "Sat" in week view, "14" in month view. */
  label: string;
  /** "Sat, Nov 14". */
  fullLabel: string;
}

export interface HabitRange {
  days: HabitRangeDay[];
  from: string;
  to: string;
  /** "Sat – Fri" for a week, "November 2026" for a month. */
  periodLabel: string;
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

function monthOf(dateString: string): { year: number; month: number } {
  return { year: Number(dateString.slice(0, 4)), month: Number(dateString.slice(5, 7)) };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1, 3);
}

/** The visible days for a week/month view, `offset` periods before the current one. */
export function habitDateRange(input: {
  todayDateString: string;
  viewMode: HabitViewMode;
  offset: number;
  weekStart: WeekdayKey;
}): HabitRange {
  const offset = Math.max(0, Math.floor(input.offset));
  const fullLabel = (d: string) => formatDateString(d, { weekday: "short", month: "short", day: "numeric" });

  if (input.viewMode === "week") {
    const first = addDays(weekStartOf(input.todayDateString, input.weekStart), -7 * offset);
    const days = Array.from({ length: 7 }, (_, i) => {
      const dateString = addDays(first, i);
      return { dateString, label: formatDateString(dateString, { weekday: "short" }), fullLabel: fullLabel(dateString) };
    });
    const order = orderedWeekdays(input.weekStart);
    return {
      days,
      from: days[0].dateString,
      to: days[6].dateString,
      periodLabel: `${capitalize(order[0])} – ${capitalize(order[6])}`,
    };
  }

  const { year, month } = monthOf(input.todayDateString);
  const index = year * 12 + (month - 1) - offset;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const length = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const days = Array.from({ length }, (_, i) => {
    const dateString = `${targetYear}-${pad(targetMonth)}-${pad(i + 1)}`;
    return { dateString, label: String(i + 1), fullLabel: fullLabel(dateString) };
  });
  return {
    days,
    from: days[0].dateString,
    to: days[length - 1].dateString,
    periodLabel: formatDateString(days[0].dateString, { month: "long", year: "numeric" }),
  };
}

/** The offset (0 = current period) whose range contains `dateString`. */
export function offsetForDate(input: {
  todayDateString: string;
  dateString: string;
  viewMode: HabitViewMode;
  weekStart: WeekdayKey;
}): number {
  if (input.viewMode === "week") {
    const diff = daysBetween(
      weekStartOf(input.dateString, input.weekStart),
      weekStartOf(input.todayDateString, input.weekStart)
    );
    return Math.max(0, Math.round(diff / 7));
  }
  const a = monthOf(input.todayDateString);
  const b = monthOf(input.dateString);
  return Math.max(0, (a.year - b.year) * 12 + (a.month - b.month));
}
