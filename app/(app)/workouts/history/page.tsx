import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth/session";
import { localDateString, weekDatesOf } from "@/lib/time";
import { listRecentPrSets } from "@/lib/workouts/records";
import { getWeekOverview, listSessions } from "@/lib/workouts/sessions";
import { HistoryList } from "@/components/workout/HistoryList";
import { TrainNav } from "@/components/workout/TrainNav";
import { WeekInsights } from "@/components/workout/WeekInsights";

export const metadata: Metadata = {
  title: "Workout history",
  description: "This week's training and every workout you have finished.",
};

export default async function WorkoutHistoryPage() {
  const session = await requirePageSession();
  const today = localDateString(new Date(), session.timezone);

  const [{ sessions, nextCursor }, week, recentRecords] = await Promise.all([
    listSessions(session.userId, { limit: 20 }),
    getWeekOverview(session.userId, weekDatesOf(today, session.weekStartDay)),
    listRecentPrSets(session.userId, 5),
  ]);

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="lg:col-span-2">
        <TrainNav current="history" />
      </div>
      <WeekInsights
        setsByMuscleGroup={week.setsByMuscleGroup}
        volumeKg={week.volumeKg}
        workoutCount={week.sessions.length}
        recentRecords={recentRecords}
        unit={session.weightUnit}
        today={today}
        timezone={session.timezone}
      />
      <HistoryList initialSessions={sessions} initialCursor={nextCursor} />
    </div>
  );
}
