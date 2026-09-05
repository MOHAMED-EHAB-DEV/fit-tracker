import React, { Suspense } from "react";
import { format } from "date-fns";
import { Loader2, PenSquare, Dumbbell, Sparkles } from "lucide-react";
import Link from "next/link";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import Workout from "@/lib/db/models/Workout";
import BodyComp from "@/lib/db/models/BodyComp";
import { getTodayDateString, getWeekStartDateString, getWeekDatesStrings } from "@/lib/fitness/timezone";

import { DashboardClientHeader } from "@/components/dashboard/DashboardClientHeader";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { EnergyBalanceChart, type IDailyHistoryPoint } from "@/components/dashboard/EnergyBalanceChart";
import { WeeklySplitMap, IWeeklyDaySession, IMuscleVolumeGroup, DayOfWeekKey } from "@/components/dashboard/WeeklySplitMap";
import { RecentPRsWidget, IRecentPR } from "@/components/dashboard/RecentPRsWidget";
import { WeightTrendWidget, type IWeightDataPoint } from "@/components/dashboard/WeightTrendWidget";
import { WaterCounter } from "@/components/dashboard/WaterCounter";
import { MealTimeline } from "@/components/dashboard/MealTimeline";
import { StreakWidget } from "@/components/dashboard/StreakWidget";
import { calculateStreak } from "@/lib/fitness/streak";
import { DAYS_OF_WEEK as DAYS_LIST } from "@/constants/workout";

async function DashboardContent() {
  const user = await getFullUser();
  await getDb();

  const todayStr = getTodayDateString();
  const weekStartStr = getWeekStartDateString();
  const weekDateStrings = getWeekDatesStrings(weekStartStr);

  // Parallel database reads
  const [todayLog, weekLogs, todayMeals, weekWorkouts, allWorkouts, bodyCompLogs, prWorkouts, allDailyLogs] = await Promise.all([
    DailyLog.findOne({ userId: user?._id, dateString: todayStr }).lean(),
    DailyLog.find({ userId: user?._id, dateString: { $in: weekDateStrings } }).lean(),
    Meal.find({ userId: user?._id, dateString: todayStr }).sort({ createdAt: 1 }).lean(),
    Workout.find({ userId: user?._id, weekStartDate: weekStartStr }).lean(),
    Workout.find({ userId: user?._id }).sort({ updatedAt: -1 }).lean(),
    BodyComp.find({ userId: user?._id }).sort({ checkInDate: 1 }).limit(10).lean(),
    Workout.find({ userId: user?._id, status: "completed" }).sort({ completedAt: -1 }).limit(20).lean(),
    DailyLog.find({ userId: user?._id }).select("dateString caloriesIn steps waterMl").lean(),
  ]);

  // Compute habit consistency and streak data
  const activeDates = new Set<string>();
  allDailyLogs.forEach((l: any) => {
    if (l.dateString && ((l.caloriesIn || 0) > 0 || (l.steps || 0) > 0 || (l.waterMl || 0) > 0)) {
      activeDates.add(l.dateString);
    }
  });
  const streakData = calculateStreak(activeDates, todayStr);

  const userBmr = user?.computed?.bmr || 1600;
  const targetCalories = user?.fitnessProfile?.targetCalories || user?.computed?.tdee || 2400;

  // 1. Prepare 7-Day Energy & Caloric Flow Data (Pure Day Names)
  const logsMap = new Map(weekLogs.map((l) => [l.dateString, l]));
  const weekWorkoutsMap = new Map(
    weekWorkouts.map((w: any) => [(w.dayOfWeek || "").toLowerCase(), w])
  );

  const energyData: IDailyHistoryPoint[] = DAYS_LIST.map((d, idx) => {
    const dayDateStr = weekDateStrings[idx];
    const dayLog = logsMap.get(dayDateStr);

    return {
      dayName: d.short,
      dateString: d.name,
      caloriesIn: dayLog?.caloriesIn || 0,
      caloriesOut: dayLog?.caloriesOut?.total || userBmr,
      targetCalories,
      protein: dayLog?.macros?.protein || 0,
      carbs: dayLog?.macros?.carbs || 0,
      fat: dayLog?.macros?.fat || 0,
      steps: dayLog?.steps || 0,
      hasWorkout: weekWorkoutsMap.has(d.key),
    };
  });

  // 2. Prepare Weekly Volume & Muscle Groups
  let totalWeeklyVolume = 0;
  const muscleSetsMap: Record<string, number> = {
    Chest: 0,
    Back: 0,
    Legs: 0,
    Shoulders: 0,
    Arms: 0,
    Core: 0,
  };

  weekWorkouts.forEach((w: any) => {
    totalWeeklyVolume += w.totalVolume || 0;
    w.exercises?.forEach((ex: any) => {
      const completedSets = ex.sets?.filter((s: any) => s.completedReps && s.weight) || [];
      const count = completedSets.length;
      const mg = ex.muscleGroup || "Other";

      if (mg.toLowerCase().includes("chest")) muscleSetsMap["Chest"] += count;
      else if (mg.toLowerCase().includes("back") || mg.toLowerCase().includes("lat") || mg.toLowerCase().includes("trap")) muscleSetsMap["Back"] += count;
      else if (mg.toLowerCase().includes("leg") || mg.toLowerCase().includes("quad") || mg.toLowerCase().includes("hamstring") || mg.toLowerCase().includes("glute") || mg.toLowerCase().includes("calf")) muscleSetsMap["Legs"] += count;
      else if (mg.toLowerCase().includes("shoulder") || mg.toLowerCase().includes("delt")) muscleSetsMap["Shoulders"] += count;
      else if (mg.toLowerCase().includes("bicep") || mg.toLowerCase().includes("tricep") || mg.toLowerCase().includes("arm")) muscleSetsMap["Arms"] += count;
      else muscleSetsMap["Core"] += count;
    });
  });

  // Current day of the week in Cairo timezone
  const currentDayOfWeekKey = format(new Date(), "EEEE").toLowerCase() as DayOfWeekKey;

  // Build weekly split days dynamically from real workouts & weekly routine
  const weeklySplitDays: IWeeklyDaySession[] = DAYS_LIST.map((d) => {
    const routineDay = user?.weeklyRoutine?.find((r: any) => r.dayOfWeek === d.key);
    const routineName = routineDay?.workoutName?.trim() || "";
    const isRoutineRest = routineDay?.isRestDay ?? false;

    // Check if there is a workout recorded for this day in the current week
    const weekWorkout = weekWorkouts.find(
      (w: any) => (w.dayOfWeek || "").toLowerCase() === d.key
    );

    // Find any workout sheet matching this day of the week
    const exactNamedWorkout = routineName
      ? allWorkouts.find(
          (w: any) =>
            (w.dayOfWeek || "").toLowerCase() === d.key &&
            w.name.toLowerCase().trim() === routineName.toLowerCase()
        )
      : null;

    const dayWorkout = allWorkouts.find(
      (w: any) => (w.dayOfWeek || "").toLowerCase() === d.key
    );

    const activeWorkout = weekWorkout || exactNamedWorkout || dayWorkout;

    // Determine the true display name: prioritize routineDay name (e.g. "Muay Thai"), or active workout, or day default
    const resolvedWorkoutName =
      routineName ||
      activeWorkout?.name ||
      (isRoutineRest ? "Rest & Recovery" : "Workout");

    const isRest =
      isRoutineRest ||
      resolvedWorkoutName.toLowerCase().includes("rest");

    if (activeWorkout) {
      const isCompletedThisWeek = !!(
        weekWorkout &&
        (weekWorkout.status === "completed" || (weekWorkout.totalVolume && weekWorkout.totalVolume > 0))
      );

      const workoutExercises = (activeWorkout.exercises || []).map((ex: any) => ({
        name: ex.name,
        muscleGroup: ex.muscleGroup || "Other",
        setsCount: ex.sets?.length || 3,
        targetReps: ex.sets?.[0]?.targetReps || ex.sets?.[0]?.completedReps || 10,
        targetWeight: ex.sets?.[0]?.targetWeight || ex.sets?.[0]?.weight || 0,
        weightUnit: ex.weightUnit || activeWorkout.weightUnit || "kg",
      }));

      const distinctMuscleGroups = Array.from(
        new Set(workoutExercises.map((e: any) => e.muscleGroup).filter(Boolean))
      ) as string[];

      return {
        dayName: d.name,
        dayShort: d.short,
        dayOfWeek: d.key,
        isToday: d.key === currentDayOfWeekKey,
        workoutName: resolvedWorkoutName,
        isRestDay: isRest,
        targetMuscleGroups:
          distinctMuscleGroups.length > 0
            ? distinctMuscleGroups
            : (routineDay?.targetMuscleGroups || []),
        exercisesCount: workoutExercises.length,
        targetSetsCount: workoutExercises.reduce((sum: number, ex: any) => sum + (ex.setsCount || 0), 0),
        workoutId: activeWorkout._id.toString(),
        isCompletedThisWeek,
        status: isCompletedThisWeek ? "completed" : activeWorkout.status || "planned",
        totalVolume: activeWorkout.totalVolume || 0,
        exercises: workoutExercises,
      };
    }

    return {
      dayName: d.name,
      dayShort: d.short,
      dayOfWeek: d.key,
      isToday: d.key === currentDayOfWeekKey,
      workoutName: resolvedWorkoutName,
      isRestDay: isRest,
      targetMuscleGroups: routineDay?.targetMuscleGroups || [],
      exercisesCount: 0,
      targetSetsCount: 0,
      exercises: [],
      workoutId: undefined,
      isCompletedThisWeek: false,
      status: isRest ? "rest" : "planned",
    };
  });

  // Calculate target muscle sets dynamically from the planned weekly split workouts
  const muscleTargetSetsMap: Record<string, number> = {
    Chest: 0,
    Back: 0,
    Legs: 0,
    Shoulders: 0,
    Arms: 0,
    Core: 0,
  };

  weeklySplitDays.forEach((day) => {
    if (!day.isRestDay && day.exercises) {
      day.exercises.forEach((ex) => {
        const mg = ex.muscleGroup || "Other";
        const count = ex.setsCount || 3;
        if (mg.toLowerCase().includes("chest")) muscleTargetSetsMap["Chest"] += count;
        else if (mg.toLowerCase().includes("back") || mg.toLowerCase().includes("lat") || mg.toLowerCase().includes("trap")) muscleTargetSetsMap["Back"] += count;
        else if (mg.toLowerCase().includes("leg") || mg.toLowerCase().includes("quad") || mg.toLowerCase().includes("hamstring") || mg.toLowerCase().includes("glute") || mg.toLowerCase().includes("calf")) muscleTargetSetsMap["Legs"] += count;
        else if (mg.toLowerCase().includes("shoulder") || mg.toLowerCase().includes("delt")) muscleTargetSetsMap["Shoulders"] += count;
        else if (mg.toLowerCase().includes("bicep") || mg.toLowerCase().includes("tricep") || mg.toLowerCase().includes("arm")) muscleTargetSetsMap["Arms"] += count;
        else muscleTargetSetsMap["Core"] += count;
      });
    }
  });

  const muscleBreakdown: IMuscleVolumeGroup[] = [
    { muscle: "Chest", sets: muscleSetsMap["Chest"], targetSets: muscleTargetSetsMap["Chest"] || 14, colorClass: "bg-emerald-500" },
    { muscle: "Back", sets: muscleSetsMap["Back"], targetSets: muscleTargetSetsMap["Back"] || 16, colorClass: "bg-teal-400" },
    { muscle: "Legs", sets: muscleSetsMap["Legs"], targetSets: muscleTargetSetsMap["Legs"] || 18, colorClass: "bg-cyan-500" },
    { muscle: "Shoulders", sets: muscleSetsMap["Shoulders"], targetSets: muscleTargetSetsMap["Shoulders"] || 12, colorClass: "bg-amber-400" },
    { muscle: "Arms", sets: muscleSetsMap["Arms"], targetSets: muscleTargetSetsMap["Arms"] || 12, colorClass: "bg-orange-400" },
    { muscle: "Core", sets: muscleSetsMap["Core"], targetSets: muscleTargetSetsMap["Core"] || 8, colorClass: "bg-purple-400" },
  ];

  // Dynamic weekly target volume calculation from routine planned sets & load
  let calculatedTargetVolume = 0;
  weeklySplitDays.forEach((day) => {
    if (!day.isRestDay && day.exercises) {
      day.exercises.forEach((ex) => {
        const sets = ex.setsCount || 3;
        const reps = ex.targetReps || 10;
        const weight = ex.targetWeight || 50;
        calculatedTargetVolume += sets * reps * weight;
      });
    }
  });
  const weeklyTargetVolumeKg = calculatedTargetVolume > 0 ? calculatedTargetVolume : 25000;

  // 3. Extract Recent PRs
  const recentPRs: IRecentPR[] = [];
  prWorkouts.forEach((w: any) => {
    const dayCap = (w.dayOfWeek || "saturday").charAt(0).toUpperCase() + (w.dayOfWeek || "saturday").slice(1);
    w.exercises?.forEach((ex: any) => {
      ex.sets?.forEach((s: any) => {
        if (s.isPR && s.weight && s.completedReps && recentPRs.length < 5) {
          const oneRMEst = Math.round(s.weight * (1 + s.completedReps / 30));
          recentPRs.push({
            exerciseName: ex.name,
            muscleGroup: ex.muscleGroup,
            weight: s.weight,
            reps: s.completedReps,
            oneRM: oneRMEst,
            dateString: dayCap,
            workoutId: w._id.toString(),
            workoutName: w.name,
          });
        }
      });
    });
  });

  // 4. Extract Weight Trend
  const weightHistory: IWeightDataPoint[] = bodyCompLogs
    .filter((b: any) => b.weight != null)
    .map((b: any) => ({
      date: format(new Date(b.checkInDate), "MM/dd"),
      weight: b.weight,
      bodyFatPercent: b.bodyFatPercent,
    }));

  // Today's Stats for MetricsGrid
  const stats = {
    caloriesIn: todayLog?.caloriesIn || 0,
    caloriesOut: todayLog?.caloriesOut?.total || userBmr,
    targetCalories,
    proteinG: todayLog?.macros?.protein || 0,
    targetProteinG: user?.fitnessProfile?.targetProteinG || user?.computed?.proteinTargetG || 160,
    carbsG: todayLog?.macros?.carbs || 0,
    targetCarbsG: Math.round((targetCalories * 0.45) / 4),
    fatG: todayLog?.macros?.fat || 0,
    targetFatG: Math.round((targetCalories * 0.25) / 9),
    steps: todayLog?.steps || 0,
    stepGoal: user?.preferences?.stepGoal || 10000,
    waterMl: todayLog?.waterMl || 0,
    waterGoalMl: user?.preferences?.waterGoalMl || 3000,
  };

  // Extract all distinct workouts available for the user
  const workoutsMapByName = new Map<string, { id?: string; name: string; muscleGroups?: string[]; exercisesCount?: number; isRest?: boolean }>();

  allWorkouts.forEach((w: any) => {
    const name = w.name?.trim();
    if (name && !workoutsMapByName.has(name.toLowerCase())) {
      const distinctMuscles = Array.from(
        new Set((w.exercises || []).map((e: any) => e.muscleGroup).filter(Boolean))
      ) as string[];
      workoutsMapByName.set(name.toLowerCase(), {
        id: w._id.toString(),
        name,
        muscleGroups: distinctMuscles,
        exercisesCount: w.exercises?.length || 0,
        isRest: name.toLowerCase().includes("rest"),
      });
    }
  });

  // Also include any custom routine day names from user's weeklyRoutine
  user?.weeklyRoutine?.forEach((r: any) => {
    const name = r.workoutName?.trim();
    if (name && !workoutsMapByName.has(name.toLowerCase())) {
      workoutsMapByName.set(name.toLowerCase(), {
        name,
        muscleGroups: r.targetMuscleGroups || [],
        exercisesCount: 0,
        isRest: r.isRestDay ?? name.toLowerCase().includes("rest"),
      });
    }
  });

  const availableWorkoutsList = Array.from(workoutsMapByName.values());

  const serializedMeals = JSON.parse(JSON.stringify(todayMeals));

  return (
    <div className="space-y-6 2xl:space-y-8 w-full max-w-[1800px] mx-auto pb-12">
      {/* Dynamic Header with Greeting & Quick Log Trigger */}
      <DashboardClientHeader
        userName={user?.name?.split(" ")[0] || "Mohamed"}
        waterMl={stats.waterMl}
      />

      {/* Prominent Quick Action: Record Real Workout Stats */}
      <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-emerald-500/15 via-teal-500/10 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-950/20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-500/20">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Weekly Training Routine
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Split
              </span>
            </div>
            <h3 className="font-extrabold text-base text-white mt-0.5">
              Record Your Real Weights & Workout Stats
            </h3>
          </div>
        </div>

        <Link
          href="/workouts/record"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition shadow-lg shadow-emerald-500/25 active:scale-95 shrink-0"
        >
          <PenSquare className="w-4 h-4" />
          <span>Record Workout Stats</span>
        </Link>
      </div>

      {/* Gamified Habit Streak & Milestones */}
      <StreakWidget streak={streakData} />

      {/* Primary Key Metrics Grid (Calories, Protein, Steps, Water) */}
      <MetricsGrid stats={stats} />

      {/* Middle Grid: Energy Balance Chart + Weekly Training Split */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 2xl:gap-8">
        <EnergyBalanceChart
          data={energyData}
          goal={user?.fitnessProfile?.goal || "maintain"}
          targetCalories={targetCalories}
        />
        <WeeklySplitMap
          days={weeklySplitDays}
          weeklyVolumeKg={totalWeeklyVolume}
          weeklyTargetVolumeKg={weeklyTargetVolumeKg}
          muscleBreakdown={muscleBreakdown}
          weeklyRoutine={user?.weeklyRoutine}
          availableWorkouts={availableWorkoutsList}
        />
      </div>

      {/* Bottom Grid: PRs Widget + Weight Trend Widget */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 2xl:gap-8">
        <RecentPRsWidget prs={recentPRs} />
        <WeightTrendWidget
          history={weightHistory}
          currentWeight={user?.fitnessProfile?.weightKg || null}
          goal={user?.fitnessProfile?.goal || "maintain"}
        />
      </div>

      {/* Quick Water Counter Widget */}
      <WaterCounter initialWaterMl={stats.waterMl} />

      {/* Today's Meals Timeline */}
      <MealTimeline meals={serializedMeals} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-zinc-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="font-semibold text-sm">Loading fitness dashboard...</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
