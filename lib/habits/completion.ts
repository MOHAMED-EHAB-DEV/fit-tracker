/**
 * Habit completion maths (isomorphic, pure).
 *
 * A habit counts towards a day only while it existed and was active that day:
 * from its creation date (inclusive) until its archive date (exclusive), both
 * calendar dates in the user's zone. Completed ids that do not belong to a
 * habit active that day (deleted/archived habits, stale planner links) are
 * ignored, so a day can never exceed 100%. Future days are never counted.
 */

export interface HabitLifespan {
  _id: string;
  /** "YYYY-MM-DD" (user zone) the habit was created. */
  createdDate: string;
  /** "YYYY-MM-DD" (user zone) the habit was archived, or null while active. */
  archivedDate: string | null;
}

export function isHabitActiveOn(habit: HabitLifespan, dateString: string): boolean {
  if (habit.createdDate && dateString < habit.createdDate) return false;
  if (habit.archivedDate && dateString >= habit.archivedDate) return false;
  return true;
}

export interface DayCompletion {
  completed: number;
  total: number;
  /** Ids from `completedIds` that count for this day. */
  completedIds: string[];
}

export function completionForDay(
  habits: HabitLifespan[],
  completedIds: Iterable<string> | null | undefined,
  dateString: string
): DayCompletion {
  const activeIds = new Set(habits.filter((h) => isHabitActiveOn(h, dateString)).map((h) => h._id));
  const counted = new Set<string>();
  for (const id of completedIds || []) {
    if (activeIds.has(String(id))) counted.add(String(id));
  }
  return { completed: counted.size, total: activeIds.size, completedIds: Array.from(counted) };
}

export interface HabitDayPoint {
  dateString: string;
  /** null for future days. */
  completedCount: number | null;
  /** Habits that were active that day; null for future days. */
  totalHabits: number | null;
  isFuture: boolean;
}

export function buildHabitHistory(input: {
  habits: HabitLifespan[];
  logsByDate: Record<string, string[] | undefined>;
  dates: string[];
  todayDateString: string;
}): HabitDayPoint[] {
  return input.dates.map((dateString) => {
    if (dateString > input.todayDateString) {
      return { dateString, completedCount: null, totalHabits: null, isFuture: true };
    }
    const day = completionForDay(input.habits, input.logsByDate[dateString], dateString);
    return { dateString, completedCount: day.completed, totalHabits: day.total, isFuture: false };
  });
}

export interface CompletionSummary {
  completed: number;
  possible: number;
  /** 0-100, or null when no habit was active on any elapsed day. */
  percent: number | null;
  elapsedDays: number;
}

/** Completion over elapsed days only (future days never dilute the rate). */
export function summarizeCompletion(points: HabitDayPoint[]): CompletionSummary {
  let completed = 0;
  let possible = 0;
  let elapsedDays = 0;
  for (const point of points) {
    if (point.isFuture || point.totalHabits === null || point.completedCount === null) continue;
    elapsedDays += 1;
    completed += point.completedCount;
    possible += point.totalHabits;
  }
  return {
    completed,
    possible,
    percent: possible > 0 ? Math.round((completed / possible) * 100) : null,
    elapsedDays,
  };
}

/** Applies one check/uncheck to a list without touching other ids. */
export function applyToggle(list: readonly string[] | undefined, habitId: string, checked: boolean): string[] {
  const current = list ? [...list] : [];
  const has = current.includes(habitId);
  if (checked && !has) current.push(habitId);
  if (!checked && has) return current.filter((id) => id !== habitId);
  return current;
}
