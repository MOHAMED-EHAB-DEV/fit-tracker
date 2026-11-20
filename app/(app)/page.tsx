import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFullUser, LOGIN_REDIRECT, requirePageSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import { addDays, formatDateString, localDateString, weekDatesOf, weekdayOfDateString } from "@/lib/time";
import { computeTargets } from "@/lib/users/profile";
import { buildEnergySeries, trackedCaloriesOut } from "@/lib/dashboard/energy";
import { buildWeightHistory } from "@/lib/dashboard/weight";
import { computeStreak } from "@/lib/fitness/streak";
import { getTodayHabitsData } from "@/lib/habits/service";
import { listMealsForDay } from "@/lib/nutrition/meals";
import { listEventsForDate } from "@/lib/planner/service";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { listRecentPrSets } from "@/lib/workouts/records";
import { getWeeklySchedule } from "@/lib/workouts/schedule";
import { getActiveSession, getWeekOverview, listTrainingDates } from "@/lib/workouts/sessions";

import { DashboardClientHeader } from "@/components/dashboard/DashboardClientHeader";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { TodayWorkoutCard, type TrainingWeekDay } from "@/components/dashboard/TodayWorkoutCard";
import { TrainingWeekWidget } from "@/components/dashboard/TrainingWeekWidget";
import { EnergyBalanceChart } from "@/components/dashboard/EnergyBalanceChart";
import { WeightTrendWidget } from "@/components/dashboard/WeightTrendWidget";
import { WaterCounter } from "@/components/dashboard/WaterCounter";
import { MealTimeline } from "@/components/dashboard/MealTimeline";
import { StreakWidget } from "@/components/dashboard/StreakWidget";
import { HabitsWidget } from "@/components/dashboard/HabitsWidget";
import { TodayPlanWidget } from "@/components/dashboard/TodayPlanWidget";

export const metadata: Metadata = {
  title: "Today",
  description: "Today's calories, training, plan and habits at a glance.",
};

/** How far back the logging streak looks. */
const STREAK_WINDOW_DAYS = 400;

/**
 * Today. Everything is computed for the user's own calendar day and week
 * (their time zone and week start), and every query is bounded.
 *
 * Order, top to bottom: today's numbers, today's training, quick logging,
 * today's plan and habits, then the trends.
 */
export default async function TodayPage() {
  const session = await requirePageSession();
  const user = await getFullUser();
  if (!user) redirect(LOGIN_REDIRECT);

  const userId = session.userId;
  const timezone = session.timezone;
  const today = localDateString(new Date(), timezone);
  const weekDates = weekDatesOf(today, session.weekStartDay);
  const streakFrom = addDays(today, -STREAK_WINDOW_DAYS);

  await getDb();
  // Older accounts are converted once, before anything is read.
  await ensureWorkoutsMigrated(userId);

  const [
    logs,
    meals,
    weightRows,
    habitsData,
    plannedEvents,
    activeSession,
    schedule,
    weekOverview,
    recentRecords,
    trainingDates,
  ] = await Promise.all([
    DailyLog.find({ userId, dateString: { $gte: streakFrom, $lte: today } })
      .select("dateString caloriesIn caloriesOut macros waterMl completedHabitIds workoutEntries workoutIds steps stepsSource")
      .lean(),
    listMealsForDay(userId, today),
    BodyComp.find({ userId, weight: { $ne: null } })
      .sort({ checkInDate: -1 })
      .limit(30)
      .select("checkInDate dateString weight bodyFatPercent")
      .lean(),
    getTodayHabitsData(userId, timezone),
    listEventsForDate(userId, today),
    getActiveSession(userId),
    getWeeklySchedule(userId, session.weekStartDay),
    getWeekOverview(userId, weekDates),
    listRecentPrSets(userId, 5),
    listTrainingDates(userId, streakFrom, today),
  ]);

  // Targets: the user's own values win; otherwise the ones calculated from the profile.
  const profile = user.fitnessProfile;
  const targets = computeTargets(profile);
  const targetCalories = profile?.targetCalories ?? targets.calorieTarget;
  const goal = profile?.goal ?? null;

  const energyLogs = logs.map((log) => ({
    dateString: log.dateString,
    caloriesIn: log.caloriesIn,
    caloriesOut: log.caloriesOut,
    macros: log.macros,
    steps: log.steps,
  }));
  const todayLog = energyLogs.find((log) => log.dateString === today) ?? null;
  const waterMl = logs.find((log) => log.dateString === today)?.waterMl || 0;

  const stats = {
    caloriesIn: Math.round(todayLog?.caloriesIn || 0),
    caloriesOut: trackedCaloriesOut(todayLog, targets.bmr),
    caloriesOutFloor: targets.tdee ?? null,
    targetCalories,
    proteinG: Math.round(todayLog?.macros?.protein || 0),
    targetProteinG: targets.proteinTargetG,
    carbsG: Math.round(todayLog?.macros?.carbs || 0),
    fatG: Math.round(todayLog?.macros?.fat || 0),
    steps: Math.round(todayLog?.steps || 0),
    stepGoal: user.preferences?.stepGoal ?? null,
    waterMl,
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

  const energySeries = buildEnergySeries({
    weekDates,
    todayDateString: today,
    logs: energyLogs,
    bmr: targets.bmr,
    tdee: targets.tdee,
    targetCalories,
  });

  const weightHistory = buildWeightHistory(
    weightRows.map((row) => ({
      checkInDate: row.checkInDate,
      dateString: row.dateString,
      weight: row.weight,
      bodyFatPercent: row.bodyFatPercent,
    })),
    30
  );

  // Training: today's plan, what was done, and the week at a glance.
  const todayKey = weekdayOfDateString(today);
  const todayPlan = schedule.find((day) => day.dayOfWeek === todayKey);
  const trainedDates = new Set(weekOverview.sessions.map((item) => item.localDate));
  const trainingWeek: TrainingWeekDay[] = weekDates.map((date) => {
    const plan = schedule.find((day) => day.dayOfWeek === weekdayOfDateString(date));
    return {
      date,
      label: formatDateString(date, { weekday: "short" }),
      isToday: date === today,
      trained: trainedDates.has(date),
      routineName: plan?.routineName ?? null,
      isRestDay: Boolean(plan?.isRestDay),
    };
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardClientHeader
        userName={user.name || null}
        waterMl={waterMl}
        dateLabel={formatDateString(today, { weekday: "long", month: "long", day: "numeric" })}
      />

      <MetricsGrid stats={stats} todayStr={today} timeZone={timezone} />

      <TodayWorkoutCard
        active={activeSession}
        todayRoutine={
          todayPlan?.routineId && todayPlan.routineName
            ? { id: todayPlan.routineId, name: todayPlan.routineName }
            : null
        }
        isRestDay={Boolean(todayPlan?.isRestDay)}
        doneToday={weekOverview.sessions.filter((item) => item.localDate === today)}
        workoutsThisWeek={weekOverview.sessions.length}
        week={trainingWeek}
      />

      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        <WaterCounter initialWaterMl={waterMl} />
        <MealTimeline meals={meals} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        <TodayPlanWidget
          initialEvents={plannedEvents.map((event) => ({
            _id: event._id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            category: event.category,
            color: event.color,
            isCompleted: event.isCompleted,
          }))}
          todayStr={today}
        />
        <HabitsWidget
          habits={habitsData.habits}
          initialCompletedHabitIds={habitsData.completedHabitIds}
          todayStr={today}
          timeZone={timezone}
        />
      </div>

      <StreakWidget streak={streak} />

      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
        <TrainingWeekWidget
          setsByMuscleGroup={weekOverview.setsByMuscleGroup}
          volumeKg={weekOverview.volumeKg}
          workoutCount={weekOverview.sessions.length}
          recentRecords={recentRecords}
          unit={session.weightUnit}
          today={today}
          timezone={timezone}
        />
        <EnergyBalanceChart data={energySeries} goal={goal} targetCalories={targetCalories} tdee={targets.tdee} />
      </div>

      <WeightTrendWidget history={weightHistory} currentWeightKg={profile?.weightKg ?? null} goal={goal} />
    </div>
  );
}
