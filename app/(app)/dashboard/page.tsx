import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFullUser, LOGIN_REDIRECT, requirePageSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import { addDays, formatDateString, localDateString, localParts, weekDatesOf, weekdayOfDateString } from "@/lib/time";
import { computeTargets } from "@/lib/users/profile";
import { computeStreak } from "@/lib/fitness/streak";
import { getTodayHabitsData } from "@/lib/habits/service";
import { listMealsForDay } from "@/lib/nutrition/meals";
import { listEventsForDate } from "@/lib/planner/service";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { listRoutines } from "@/lib/workouts/routines";
import { getWeeklySchedule } from "@/lib/workouts/schedule";
import { getActiveSession, getWeekOverview, listTrainingDates } from "@/lib/workouts/sessions";

import { HeaderActions } from "@/components/shared/HeaderSlot";
import { StreakChip } from "@/components/dashboard/StreakChip";
import { WorkoutHero, type TrainingWeekDay } from "@/components/dashboard/WorkoutHero";
import { FuelLedger } from "@/components/dashboard/FuelLedger";
import { StepsCell } from "@/components/dashboard/StepsCell";
import { WaterCell } from "@/components/dashboard/WaterCell";
import { RhythmList, type NextEvent } from "@/components/dashboard/RhythmList";
import { MealsToday } from "@/components/dashboard/MealsToday";
import { TodayLive } from "@/components/dashboard/TodayLive";

export const metadata: Metadata = {
  title: "Today",
  description: "Today's training, calories left, plan and habits.",
};

/** How far back the logging streak looks. */
const STREAK_WINDOW_DAYS = 400;
/** How many upcoming planner events Today shows. */
const NEXT_EVENTS = 2;

function minutesOf(time: string | undefined | null): number | null {
  const match = time ? /^(\d{1,2}):(\d{2})$/.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Today: the workout for the day, the fuel ledger, what is next and today's
 * habits, and today's meals. Everything is computed for the user's own day
 * and week (time zone and week start), and every query is bounded.
 *
 * Weekly training stats live in Train, energy balance in Eat, the weight
 * trend in Body.
 */
export default async function TodayPage() {
  const session = await requirePageSession();
  const user = await getFullUser();
  if (!user) redirect(LOGIN_REDIRECT);

  const userId = session.userId;
  const timezone = session.timezone;
  const now = new Date();
  const today = localDateString(now, timezone);
  const weekDates = weekDatesOf(today, session.weekStartDay);
  const streakFrom = addDays(today, -STREAK_WINDOW_DAYS);

  await getDb();
  // Older accounts are converted once, before anything is read.
  await ensureWorkoutsMigrated(userId);

  const [logs, meals, habitsData, plannedEvents, activeSession, schedule, weekOverview, trainingDates, routineList] =
    await Promise.all([
      DailyLog.find({ userId, dateString: { $gte: streakFrom, $lte: today } })
        .select("dateString caloriesIn macros waterMl completedHabitIds workoutEntries workoutIds steps stepsSource")
        .lean(),
      listMealsForDay(userId, today),
      getTodayHabitsData(userId, timezone),
      listEventsForDate(userId, today),
      getActiveSession(userId),
      getWeeklySchedule(userId, session.weekStartDay),
      getWeekOverview(userId, weekDates),
      listTrainingDates(userId, streakFrom, today),
      // For "Start a different workout": any routine can be started on any day.
      listRoutines(userId),
    ]);

  // Targets: the user's own values win; otherwise the ones calculated from the profile.
  const profile = user.fitnessProfile;
  const targets = computeTargets(profile);
  const targetCalories = profile?.targetCalories ?? targets.calorieTarget;

  const todayLog = logs.find((log) => log.dateString === today) ?? null;
  const stats = {
    caloriesIn: Math.round(todayLog?.caloriesIn || 0),
    targetCalories: targetCalories ?? null,
    proteinG: Math.round(todayLog?.macros?.protein || 0),
    targetProteinG: targets.proteinTargetG ?? null,
    carbsG: Math.round(todayLog?.macros?.carbs || 0),
    fatG: Math.round(todayLog?.macros?.fat || 0),
    steps: Math.round(todayLog?.steps || 0),
    stepGoal: user.preferences?.stepGoal ?? null,
    waterMl: todayLog?.waterMl || 0,
    waterGoalMl: user.preferences?.waterGoalMl ?? null,
  };

  const streak = computeStreak({
    logs: logs.map((log) => ({
      dateString: log.dateString,
      caloriesIn: log.caloriesIn,
      waterMl: log.waterMl,
      completedHabitIds: log.completedHabitIds,
      workoutEntries: log.workoutEntries,
      workoutIds: log.workoutIds,
      steps: log.steps,
      stepsSource: log.stepsSource,
    })),
    todayDateString: today,
    extraActiveDates: trainingDates,
  });

  // Training: today's plan, what was done, and the week at a glance.
  const todayPlan = schedule.find((day) => day.dayOfWeek === weekdayOfDateString(today));
  const plannedRoutine = todayPlan?.routineId
    ? routineList.find((routine) => routine.id === todayPlan.routineId)
    : undefined;
  const todayRoutine =
    todayPlan?.routineId && todayPlan.routineName
      ? {
          id: todayPlan.routineId,
          name: plannedRoutine?.name ?? todayPlan.routineName,
          exerciseCount: plannedRoutine?.exerciseCount ?? null,
          setCount: plannedRoutine?.setCount ?? null,
        }
      : null;
  const routines = routineList.map((routine) => ({
    id: routine.id,
    name: routine.name,
    exerciseCount: routine.exerciseCount,
    lastPerformedAt: routine.lastPerformedAt,
  }));
  const trainedDates = new Set(weekOverview.sessions.map((item) => item.localDate));
  const week: TrainingWeekDay[] = weekDates.map((date) => {
    const plan = schedule.find((day) => day.dayOfWeek === weekdayOfDateString(date));
    return {
      date,
      letter: formatDateString(date, { weekday: "narrow" }),
      name: formatDateString(date, { weekday: "long" }),
      isToday: date === today,
      trained: trainedDates.has(date),
      routineName: plan?.routineName ?? null,
      isRestDay: Boolean(plan?.isRestDay),
    };
  });
  const doneToday = weekOverview.sessions
    .filter((item) => item.localDate === today && item.status === "completed")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  // Up next: today's planner events that are not done and have not ended yet.
  const parts = localParts(now, timezone);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const nextEvents: NextEvent[] = plannedEvents
    .filter((event) => !event.isCompleted)
    .filter((event) => (minutesOf(event.endTime) ?? minutesOf(event.startTime) ?? 24 * 60) >= nowMinutes)
    .sort((a, b) => (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0))
    .slice(0, NEXT_EVENTS)
    .map((event) => ({
      id: String(event._id),
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      color: event.color,
    }));

  return (
    <div className="space-y-3 pb-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      <HeaderActions>
        <StreakChip streak={streak} />
      </HeaderActions>
      <TodayLive
        todayStr={today}
        timeZone={timezone}
        stats={stats}
        streak={{
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          isLoggedToday: streak.isLoggedToday,
        }}
      />

      <div className="space-y-3">
        <WorkoutHero
          active={activeSession}
          todayRoutine={todayRoutine}
          isRestDay={Boolean(todayPlan?.isRestDay)}
          doneToday={doneToday}
          week={week}
          routines={routines}
          today={today}
        />
        <FuelLedger
          caloriesIn={stats.caloriesIn}
          targetCalories={stats.targetCalories}
          proteinG={stats.proteinG}
          targetProteinG={stats.targetProteinG}
          carbsG={stats.carbsG}
          fatG={stats.fatG}
          steps={<StepsCell storedSteps={stats.steps} goal={stats.stepGoal} todayStr={today} timeZone={timezone} />}
          water={<WaterCell initialWaterMl={stats.waterMl} goalMl={stats.waterGoalMl} />}
        />
      </div>

      <div className="space-y-3 pt-1 lg:pt-0">
        <RhythmList
          events={nextEvents}
          habits={habitsData.habits}
          initialCompletedHabitIds={habitsData.completedHabitIds}
          todayStr={today}
          timeZone={timezone}
        />
        <MealsToday meals={meals} todayStr={today} />
      </div>
    </div>
  );
}
