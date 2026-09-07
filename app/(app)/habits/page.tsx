import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import DailyLog from "@/lib/db/models/DailyLog";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { HabitsPage } from "@/components/habits/HabitsPage";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Habits | FitTracker AI",
  description: "Track and build your daily life habits with comprehensive consistency analytics.",
};

async function HabitsContent() {
  const user = await getFullUser();
  if (!user) {
    redirect("/login");
  }

  await getDb();
  const todayStr = getTodayDateString();

  const [habits, todayLog] = await Promise.all([
    Habit.find({ userId: user._id, isActive: true })
      .sort({ order: 1, createdAt: 1 })
      .lean(),
    DailyLog.findOne({ userId: user._id, dateString: todayStr })
      .select("completedHabitIds")
      .lean(),
  ]);

  const serializedHabits = habits.map((h: any) => ({
    _id: h._id.toString(),
    name: h.name,
    emoji: h.emoji || "⚡",
    color: h.color || "#10b981",
    order: h.order || 0,
  }));

  const initialCompletedHabitIds = (todayLog?.completedHabitIds || []).map(String);

  return (
    <HabitsPage
      initialHabits={serializedHabits}
      initialCompletedHabitIds={initialCompletedHabitIds}
      todayStr={todayStr}
    />
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-zinc-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="font-semibold text-sm">Loading daily habits...</span>
        </div>
      }
    >
      <HabitsContent />
    </Suspense>
  );
}
