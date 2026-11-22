import React, { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { requirePageSession } from "@/lib/auth/session";
import { getTodayHabitsData } from "@/lib/habits/service";
import { HabitsPage } from "@/components/habits/HabitsPage";

export const metadata = {
  title: "Habits",
  description: "Tick off your daily habits and see how consistent you have been.",
};

async function HabitsContent() {
  const session = await requirePageSession();
  const data = await getTodayHabitsData(session.userId, session.timezone, { includeArchived: true });

  return (
    <HabitsPage
      initialHabits={data.habits}
      initialArchivedHabits={data.archived}
      initialCompletedHabitIds={data.completedHabitIds}
      todayStr={data.todayDateString}
      timeZone={session.timezone}
      weekStartDay={session.weekStartDay}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton cards={2} />}>
      <HabitsContent />
    </Suspense>
  );
}
