import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth/session";
import { localDateString, weekDatesOf, weekdayOfDateString } from "@/lib/time";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { listRoutines } from "@/lib/workouts/routines";
import { getWeeklySchedule } from "@/lib/workouts/schedule";
import { getActiveSession, getWeekOverview } from "@/lib/workouts/sessions";
import { WORKOUT_TEMPLATES } from "@/lib/workouts/templates";
import { TrainHub } from "@/components/workout/TrainHub";

export const metadata: Metadata = {
  title: "Train",
  description: "Start a workout, plan your training week and manage your routines.",
};

export default async function TrainPage() {
  const session = await requirePageSession();
  const today = localDateString(new Date(), session.timezone);
  const weekDates = weekDatesOf(today, session.weekStartDay);

  // Older accounts are converted once, before anything is read.
  await ensureWorkoutsMigrated(session.userId);

  const [active, routines, schedule, week] = await Promise.all([
    getActiveSession(session.userId),
    listRoutines(session.userId),
    getWeeklySchedule(session.userId, session.weekStartDay),
    getWeekOverview(session.userId, weekDates),
  ]);

  return (
    <TrainHub
      active={active}
      routines={routines}
      schedule={schedule}
      weekDates={weekDates}
      today={today}
      todayKey={weekdayOfDateString(today)}
      weekSessions={week.sessions}
      templates={WORKOUT_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        exerciseCount: template.exercises.length,
      }))}
    />
  );
}
