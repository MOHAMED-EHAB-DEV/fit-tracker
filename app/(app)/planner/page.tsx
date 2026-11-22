import React, { Suspense } from "react";
import { requirePageSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { listEventsForDate } from "@/lib/planner/service";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_EMOJI } from "@/lib/habits/colors";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import PlannerPage from "@/components/planner/PlannerPage";

export const metadata = {
  title: "Planner",
  description: "Plan your day in time blocks and link events to your daily habits.",
};

async function PlannerContent() {
  const session = await requirePageSession();
  await getDb();

  const todayStr = getTodayDateString(new Date(), session.timezone);
  const [events, habits] = await Promise.all([
    listEventsForDate(session.userId, todayStr),
    Habit.find({ userId: session.userId, isActive: true })
      .select("_id name emoji color")
      .sort({ order: 1, createdAt: 1 })
      .lean(),
  ]);

  const availableHabits = habits.map((habit) => ({
    _id: String(habit._id),
    name: habit.name,
    emoji: habit.emoji || DEFAULT_HABIT_EMOJI,
    color: habit.color || DEFAULT_HABIT_COLOR,
  }));

  return (
    <PlannerPage
      initialDate={todayStr}
      initialEvents={events}
      availableHabits={availableHabits}
      timeZone={session.timezone}
      weekStartDay={session.weekStartDay}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton cards={3} />}>
      <PlannerContent />
    </Suspense>
  );
}
