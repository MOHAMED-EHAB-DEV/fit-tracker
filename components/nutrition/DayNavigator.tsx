"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateStepper } from "@/components/ui/DateStepper";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { useUser } from "@/context/UserContext";
import { EARLIEST_LOG_DATE } from "@/lib/nutrition/meal-time";

const CALENDAR_WEEK_START: Record<string, 0 | 1 | 6> = { saturday: 6, sunday: 0, monday: 1 };

interface DayNavigatorProps {
  /** "YYYY-MM-DD" being shown. */
  selectedDate: string;
  /** The user's today, computed on the server in the user's zone. */
  todayStr: string;
  /** Days that have meals (calendar dots). */
  datesWithMeals?: string[];
}

/** Eat › Day: previous day · the date (opens a calendar) · next day; each day is its own address. */
export function DayNavigator({ selectedDate, todayStr, datesWithMeals = [] }: DayNavigatorProps) {
  const router = useRouter();
  const tz = useUserTimeZone();
  const { weekStartDay } = useUser();
  const [isPending, startTransition] = useTransition();

  const navigateTo = (target: string) => {
    const now = todayInZone(tz);
    const clamped = target > now ? now : target < EARLIEST_LOG_DATE ? EARLIEST_LOG_DATE : target;
    startTransition(() => router.push(clamped === now ? "/nutrition" : `/nutrition?date=${clamped}`));
  };

  return (
    <DateStepper
      value={selectedDate}
      today={todayStr}
      onChange={navigateTo}
      min={EARLIEST_LOG_DATE}
      weekStartsOn={CALENDAR_WEEK_START[weekStartDay] ?? 6}
      indicatorDates={datesWithMeals}
      indicatorLabel="Days with meals"
      busy={isPending}
    />
  );
}

export default DayNavigator;
