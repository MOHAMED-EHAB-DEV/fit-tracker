/**
 * Logging streaks (pure, isomorphic). A day counts only when the user logged
 * something themselves; background step syncs alone never count.
 */
import { addDays, daysBetween, isValidDateString } from "@/lib/time";

export interface IStreakData {
  currentStreak: number;
  longestStreak: number;
  /** 0-100: share of the last 30 days (including today) that were active. */
  consistencyRate30d: number;
  isLoggedToday: boolean;
  /** Next milestone in days; null once every milestone is reached. */
  nextMilestone: number | null;
  badgeTitle: string;
  totalActiveDays: number;
}

export const STREAK_MILESTONES = [
  { days: 3, title: "Spark" },
  { days: 7, title: "Warrior" },
  { days: 14, title: "Iron Core" },
  { days: 21, title: "Habit Builder" },
  { days: 30, title: "Titan" },
  { days: 60, title: "Unstoppable" },
  { days: 90, title: "Mastery" },
  { days: 180, title: "Centurion" },
  { days: 365, title: "Living Legend" },
] as const;

/** Fields of a DailyLog that show user activity. */
export interface StreakLogInput {
  dateString: string;
  caloriesIn?: number | null;
  waterMl?: number | null;
  completedHabitIds?: readonly unknown[] | null;
  workoutEntries?: readonly unknown[] | null;
  workoutIds?: readonly unknown[] | null;
  steps?: number | null;
  /** "manual" = typed in by the user; "step_counter" = background sync. */
  stepsSource?: string | null;
}

/** True when the user logged food, water, a habit, a workout, or steps by hand that day. */
export function isUserLoggedDay(log: StreakLogInput): boolean {
  return (
    (log.caloriesIn || 0) > 0 ||
    (log.waterMl || 0) > 0 ||
    (log.completedHabitIds?.length || 0) > 0 ||
    (log.workoutEntries?.length || 0) > 0 ||
    (log.workoutIds?.length || 0) > 0 ||
    ((log.steps || 0) > 0 && log.stepsSource === "manual")
  );
}

/**
 * Streak from daily logs plus any other active dates the caller knows about
 * (e.g. WorkoutSession.localDate of completed sessions).
 */
export function computeStreak(input: {
  logs: StreakLogInput[];
  todayDateString: string;
  extraActiveDates?: Iterable<string>;
}): IStreakData {
  const active = new Set<string>();
  for (const log of input.logs) if (isUserLoggedDay(log)) active.add(log.dateString);
  for (const date of input.extraActiveDates || []) active.add(date);
  return calculateStreak(active, input.todayDateString);
}

/** Streak from a set of active "YYYY-MM-DD" dates. Invalid and future dates are ignored. */
export function calculateStreak(activeDates: Iterable<string>, todayStr: string): IStreakData {
  const dates = new Set<string>();
  for (const date of activeDates) {
    if (isValidDateString(date) && date <= todayStr) dates.add(date);
  }

  const isLoggedToday = dates.has(todayStr);
  let currentStreak = 0;
  let cursor: string | null = isLoggedToday ? todayStr : dates.has(addDays(todayStr, -1)) ? addDays(todayStr, -1) : null;
  while (cursor && dates.has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  let longestStreak = currentStreak;
  let run = 0;
  let previous: string | null = null;
  for (const date of Array.from(dates).sort()) {
    run = previous !== null && daysBetween(previous, date) === 1 ? run + 1 : 1;
    previous = date;
    if (run > longestStreak) longestStreak = run;
  }

  let activeInLast30 = 0;
  for (let i = 0; i < 30; i++) if (dates.has(addDays(todayStr, -i))) activeInLast30 += 1;

  let badgeTitle = "Novice";
  let nextMilestone: number | null = null;
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak >= milestone.days) {
      badgeTitle = milestone.title;
    } else {
      nextMilestone = milestone.days;
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    consistencyRate30d: Math.round((activeInLast30 / 30) * 100),
    isLoggedToday,
    nextMilestone,
    badgeTitle,
    totalActiveDays: dates.size,
  };
}
