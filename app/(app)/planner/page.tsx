import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent from "@/lib/db/models/PlannedEvent";
import Habit from "@/lib/db/models/Habit";
import { getTodayDateString } from "@/lib/fitness/timezone";
import PlannerPage from "@/components/planner/PlannerPage";
import { redirect } from "next/navigation";
import { parseISO, getDay, getDate } from "date-fns";
import { sortEventsByPlannerTime } from "@/lib/planner/time-sort";

export const metadata = {
  title: "Day Planner | FitTracker AI",
  description: "Schedule your days by time with custom events, active habit links, and notification reminders.",
};

async function PlannerContent() {
  const user = await getFullUser();
  if (!user) {
    redirect("/login");
  }

  await getDb();
  const todayStr = getTodayDateString();

  const [oneTimeEvents, recurringEvents, habits] = await Promise.all([
    PlannedEvent.find({
      userId: user._id,
      date: todayStr,
      recurrence: { $in: ["once", null] },
    })
      .populate("linkedHabitIds", "name emoji color")
      .lean(),
    PlannedEvent.find({
      userId: user._id,
      date: { $lte: todayStr },
      recurrence: { $in: ["daily", "weekly", "monthly"] },
    })
      .populate("linkedHabitIds", "name emoji color")
      .lean(),
    Habit.find({ userId: user._id, isActive: true })
      .select("_id name emoji color")
      .sort({ order: 1, createdAt: 1 })
      .lean(),
  ]);

  const targetParsed = parseISO(todayStr);
  const targetDayOfWeek = getDay(targetParsed);
  const targetDayOfMonth = getDate(targetParsed);

  const matchingRecurring = recurringEvents.filter((event: any) => {
    if (event.excludedDates && event.excludedDates.includes(todayStr)) return false;
    if (event.recurrence === "daily") return true;

    const eventParsed = parseISO(event.date);
    if (event.recurrence === "weekly") return getDay(eventParsed) === targetDayOfWeek;
    if (event.recurrence === "monthly") return getDate(eventParsed) === targetDayOfMonth;
    return false;
  });

  const formattedOneTime = oneTimeEvents.map((e: any) => ({
    ...e,
    _id: e._id.toString(),
    isCompleted: Boolean(e.isCompleted),
  }));

  const formattedRecurring = matchingRecurring.map((e: any) => ({
    ...e,
    _id: e._id.toString(),
    isCompleted: Array.isArray(e.completedDates) && e.completedDates.includes(todayStr),
  }));

  const initialEvents = sortEventsByPlannerTime([...formattedOneTime, ...formattedRecurring]);

  const serializedEvents = JSON.parse(JSON.stringify(initialEvents));
  const serializedHabits = JSON.parse(JSON.stringify(habits));

  return (
    <PlannerPage
      initialDate={todayStr}
      initialEvents={serializedEvents}
      availableHabits={serializedHabits}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-zinc-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="font-semibold text-sm">Loading Day Planner...</span>
        </div>
      }
    >
      <PlannerContent />
    </Suspense>
  );
}
