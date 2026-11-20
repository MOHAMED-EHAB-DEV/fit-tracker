import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { getTodayHabitsData } from "@/lib/habits/service";
import { HabitsPage } from "@/components/habits/HabitsPage";

export const metadata = {
  title: "Habits",
  description: "Track and build your daily life habits with comprehensive consistency analytics.",
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
    <Suspense
      fallback={
        <div role="status" className="flex items-center justify-center min-h-[60vh] text-zinc-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden="true" />
          <span className="font-semibold text-sm">Loading daily habits...</span>
        </div>
      }
    >
      <HabitsContent />
    </Suspense>
  );
}
