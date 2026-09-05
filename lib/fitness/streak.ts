import { subDays, format, parseISO, differenceInCalendarDays } from "date-fns";

export interface IStreakData {
  currentStreak: number;
  longestStreak: number;
  consistencyRate30d: number; // 0 - 100 percentage
  isLoggedToday: boolean;
  nextMilestone: number;
  badgeTitle: string;
  totalActiveDays: number;
}

const STREAK_MILESTONES = [
  { days: 3, title: "Spark" },
  { days: 7, title: "Warrior" },
  { days: 14, title: "Iron Core" },
  { days: 21, title: "Habit Builder" },
  { days: 30, title: "Titan" },
  { days: 60, title: "Unstoppable" },
  { days: 90, title: "Mastery" },
  { days: 180, title: "Centurion" },
  { days: 365, title: "Living Legend" },
];

export function calculateStreak(
  activeDatesSet: Set<string>, // Set of 'YYYY-MM-DD' strings where user was active
  todayStr: string
): IStreakData {
  const today = parseISO(todayStr);
  const isLoggedToday = activeDatesSet.has(todayStr);

  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  const isLoggedYesterday = activeDatesSet.has(yesterdayStr);

  // 1. Calculate Current Streak
  let currentStreak = 0;
  let checkDate = isLoggedToday ? today : isLoggedYesterday ? subDays(today, 1) : null;

  if (checkDate) {
    while (true) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      if (activeDatesSet.has(dateStr)) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  // 2. Calculate Longest Streak from sorted dates
  const sortedDates = Array.from(activeDatesSet).sort();
  let longestStreak = currentStreak;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const d = parseISO(dateStr);
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diff = differenceInCalendarDays(d, prevDate);
      if (diff === 1) {
        tempStreak++;
      } else if (diff > 1) {
        tempStreak = 1;
      }
    }
    prevDate = d;
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }

  // 3. 30-Day Consistency Rate
  let activeInLast30 = 0;
  for (let i = 0; i < 30; i++) {
    const dStr = format(subDays(today, i), "yyyy-MM-dd");
    if (activeDatesSet.has(dStr)) {
      activeInLast30++;
    }
  }
  const consistencyRate30d = Math.round((activeInLast30 / 30) * 100);

  // 4. Milestone & Badge
  let badgeTitle = "Novice";
  let nextMilestone = 3;

  for (const m of STREAK_MILESTONES) {
    if (currentStreak >= m.days) {
      badgeTitle = m.title;
    } else {
      nextMilestone = m.days;
      break;
    }
  }

  return {
    currentStreak,
    longestStreak,
    consistencyRate30d,
    isLoggedToday,
    nextMilestone,
    badgeTitle,
    totalActiveDays: activeDatesSet.size,
  };
}
