import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { listEventsForDate } from "@/lib/planner/service";
import PlannerPage from "@/components/planner/PlannerPage";

export const metadata = {
  title: "Planner",
  description: "Schedule your day in time blocks and link events to your daily habits.",
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
    emoji: habit.emoji || "⚡",
    color: habit.color || "#10b981",
  }));

  return (
    <PlannerPage
      initialDate={todayStr}
      initialEvents={events}
      availableHabits={availableHabits}
      timeZone={session.timezone}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-zinc-400 gap-2" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden="true" />
          <span className="font-semibold text-sm">Loading Day Planner...</span>
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
