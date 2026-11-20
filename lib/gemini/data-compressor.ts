import "server-only";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Meal from "@/lib/db/models/Meal";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { formatWeight, formatVolume, type WeightUnit } from "@/lib/fitness/units";
import { localDateString, zonedTimeToUtc } from "@/lib/time";
import { computeTargets } from "@/lib/users/profile";
import { clampDays, defaultDaysForType, type CoachDataType } from "@/lib/gemini/command-parser";
import {
  average,
  nutritionStats,
  perWeek,
  topSetsByExercise,
  weightTrend,
  windowStart,
  workingSetsByMuscle,
  type ContextSession,
  type DayTotals,
} from "@/lib/assistant/context-math";
import type { DataContextSummary } from "@/types/gemini";

export interface CompressOptions {
  userId: string;
  dataType: CoachDataType;
  days?: number;
  timeZone: string;
  weightUnit: WeightUnit;
}

export interface CompressedResult {
  textContext: string;
  summary: DataContextSummary;
}

const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const orNotSet = (value: number | null | undefined, suffix: string) =>
  typeof value === "number" && value > 0 ? `${fmt(value)} ${suffix}` : "not set";

/**
 * Builds the text block of the user's own data that the coach sees.
 * Every number is computed from stored records in the user's time zone;
 * values the user never set are written as "not set", never guessed.
 * Weights are stored in kg and shown in the user's unit.
 */
export async function compressDataForCoach(options: CompressOptions): Promise<CompressedResult> {
  await getDb();
  const { userId, dataType, timeZone, weightUnit } = options;
  const today = getTodayDateString(new Date(), timeZone);
  const days = clampDays(options.days, defaultDaysForType(dataType));
  const start = windowStart(today, days);
  const weight = (kg: number) => formatWeight(kg, weightUnit);

  const user = await User.findById(userId).select("fitnessProfile preferences computed").lean();
  const profile = user?.fitnessProfile;
  const auto = profile ? computeTargets(profile) : null;
  const calorieTarget = profile?.targetCalories ?? auto?.calorieTarget ?? null;
  const proteinTarget = user?.computed?.proteinTargetG ?? auto?.proteinTargetG ?? null;
  const tdee = user?.computed?.tdee ?? auto?.tdee ?? null;
  const stepGoal = user?.preferences?.stepGoal ?? null;
  const waterGoal = user?.preferences?.waterGoalMl ?? null;

  const lines: string[] = [
    "[USER PROFILE]",
    `Goal: ${profile?.goal || "not set"} | Body weight: ${profile?.weightKg ? weight(profile.weightKg) : "not recorded"} | Weight unit: ${weightUnit}`,
    `Calorie target: ${orNotSet(calorieTarget, "kcal")} | Protein target: ${orNotSet(proteinTarget, "g")} | Estimated TDEE: ${orNotSet(tdee, "kcal")}`,
    `Step goal: ${orNotSet(stepGoal, "steps")} | Water goal: ${orNotSet(waterGoal, "ml")}`,
    `Today's date: ${today} (time zone ${timeZone})`,
  ];
  let recordsCount = 0;

  if (dataType === "today") {
    const [todayLog, meals, sessions] = await Promise.all([
      DailyLog.findOne({ userId, dateString: today }).select("waterMl steps").lean(),
      Meal.find({ userId, dateString: today }).sort({ loggedAt: 1 }).select("mealType description macros").lean(),
      WorkoutSession.find({ userId, status: "completed", localDate: today }).select("name totals durationSec").lean(),
    ]);
    recordsCount = meals.length + sessions.length + (todayLog ? 1 : 0);
    const sum = (pick: (m: (typeof meals)[number]) => number | undefined) => meals.reduce((s, m) => s + (pick(m) || 0), 0);
    const calories = sum((m) => m.macros?.calories);
    const protein = sum((m) => m.macros?.protein);

    lines.push(
      "",
      `[TODAY SO FAR (${today}, day not finished)]`,
      `Calories eaten: ${fmt(calories)} kcal${calorieTarget ? ` of ${fmt(calorieTarget)} (remaining ${fmt(Math.max(0, calorieTarget - calories))})` : ""}`,
      `Protein: ${fmt(protein)} g${proteinTarget ? ` of ${fmt(proteinTarget)} g` : ""} | Carbs: ${fmt(sum((m) => m.macros?.carbs))} g | Fat: ${fmt(sum((m) => m.macros?.fat))} g`,
      `Water: ${fmt(todayLog?.waterMl || 0)} ml${waterGoal ? ` of ${fmt(waterGoal)}` : ""} | Steps: ${fmt(todayLog?.steps || 0)}${stepGoal ? ` of ${fmt(stepGoal)}` : ""}`,
      sessions.length
        ? `Completed workouts: ${sessions.map((s) => `${s.name} (${s.totals?.completedSets || 0} sets, ${formatVolume(s.totals?.volumeKg, weightUnit)})`).join(", ")}`
        : "Completed workouts: none yet",
      meals.length ? "Meals:" : "Meals: none logged yet"
    );
    meals.forEach((m, i) =>
      lines.push(
        ` ${i + 1}. [${m.mealType}] ${(m.description || "Meal").slice(0, 80)}: ${fmt(m.macros?.calories || 0)} kcal, P ${fmt(m.macros?.protein || 0)} g, C ${fmt(m.macros?.carbs || 0)} g, F ${fmt(m.macros?.fat || 0)} g`
      )
    );
  }

  if (dataType === "meals" || dataType === "all" || dataType === "progress") {
    const meals = await Meal.find({ userId, dateString: { $gte: start, $lte: today } })
      .sort({ dateString: 1, loggedAt: 1 })
      .select("dateString description macros")
      .lean();
    recordsCount += meals.length;

    const byDate = new Map<string, DayTotals & { names: string[] }>();
    for (const meal of meals) {
      const day = byDate.get(meal.dateString) || {
        date: meal.dateString,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        meals: 0,
        names: [],
      };
      day.calories += meal.macros?.calories || 0;
      day.protein += meal.macros?.protein || 0;
      day.carbs += meal.macros?.carbs || 0;
      day.fat += meal.macros?.fat || 0;
      day.meals += 1;
      if (day.names.length < 3) day.names.push((meal.description || "Meal").slice(0, 30));
      byDate.set(meal.dateString, day);
    }
    const dayList = Array.from(byDate.values());
    const stats = nutritionStats(dayList, { start, today }, { calories: calorieTarget, protein: proteinTarget });

    lines.push(
      "",
      `[NUTRITION: ${start} to ${today}, ${days} days]`,
      `Meals logged: ${meals.length}. Completed days with meals: ${stats.loggedDays} of ${stats.completeDays} (today is excluded from averages).`,
      stats.loggedDays
        ? `Average per logged day: ${fmt(stats.avgCalories || 0)} kcal, P ${fmt(stats.avgProtein || 0)} g, C ${fmt(stats.avgCarbs || 0)} g, F ${fmt(stats.avgFat || 0)} g`
        : "Average per logged day: no completed days with meals",
      stats.calorieHitDays === null
        ? "Calorie adherence: no calorie target set"
        : `Days within ±10% of ${fmt(calorieTarget || 0)} kcal: ${stats.calorieHitDays} of ${stats.loggedDays} logged days`,
      stats.proteinHitDays === null
        ? "Protein adherence: no protein target set"
        : `Days with >= ${fmt((proteinTarget || 0) * 0.9)} g protein: ${stats.proteinHitDays} of ${stats.loggedDays} logged days`,
      "[DAILY TOTALS]"
    );
    if (dayList.length === 0) lines.push("No meals logged in this period.");
    for (const day of dayList.slice(-31)) {
      lines.push(
        `${day.date}${day.date === today ? " (today, partial)" : ""}: ${fmt(day.calories)} kcal, P ${fmt(day.protein)} g, C ${fmt(day.carbs)} g, F ${fmt(day.fat)} g | ${day.meals} meals | ${day.names.join(", ")}`
      );
    }
  }

  if (dataType === "workouts" || dataType === "all" || dataType === "progress") {
    const raw = await WorkoutSession.find({ userId, status: "completed", localDate: { $gte: start, $lte: today } })
      .sort({ localDate: 1, endedAt: 1 })
      .select("localDate name durationSec totals exercises")
      .lean();
    recordsCount += raw.length;

    const sessions: ContextSession[] = raw.map((s) => ({
      localDate: s.localDate,
      name: s.name,
      durationSec: s.durationSec ?? null,
      volumeKg: s.totals?.volumeKg || 0,
      exercises: (s.exercises || []).map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        trackingType: e.trackingType,
        sets: (e.sets || []).map((set) => ({
          type: set.type,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSec: set.durationSec,
          distanceM: set.distanceM,
          done: set.done,
          prKinds: set.prKinds || [],
        })),
      })),
    }));

    const muscleSets = workingSetsByMuscle(sessions);
    const totalVolume = sessions.reduce((sum, s) => sum + s.volumeKg, 0);
    const durations = sessions.map((s) => s.durationSec).filter((d): d is number => typeof d === "number" && d > 0);
    const avgDuration = average(durations);
    const topSets = topSetsByExercise(sessions);
    const prs = topSets.filter((t) => t.isPr);

    lines.push(
      "",
      `[TRAINING: ${start} to ${today}, ${days} days]`,
      `Completed sessions: ${sessions.length} | Total volume (working sets): ${formatVolume(totalVolume, weightUnit)} | Average session: ${
        avgDuration ? `${Math.round(avgDuration / 60)} min` : "unknown"
      }`,
      `Working sets per muscle group (warm-ups excluded), total and per week: ${
        Object.entries(muscleSets)
          .sort((a, b) => b[1] - a[1])
          .map(([group, count]) => `${group} ${count} (${perWeek(count, days)}/wk)`)
          .join(" | ") || "none"
      }`,
      `PR sets in window: ${
        prs.length
          ? prs
              .slice(-8)
              .map((p) => `${p.exercise} ${weight(p.weightKg)} x ${p.reps} (${p.date})`)
              .join("; ")
          : "none"
      }`,
      "[BEST WORKING SET PER EXERCISE]"
    );
    if (topSets.length === 0) lines.push("None in this period.");
    for (const top of topSets.slice(0, 20)) {
      lines.push(
        `${top.exercise}: ${weight(top.weightKg)} x ${top.reps}${top.e1rmKg ? ` (est. 1RM ${weight(top.e1rmKg)})` : ""} on ${top.date}`
      );
    }
    lines.push("[RECENT SESSIONS]");
    if (sessions.length === 0) lines.push("No completed workouts in this period.");
    for (const s of sessions.slice(-10)) {
      lines.push(
        `${s.localDate} ${s.name}: ${s.exercises.length} exercises, ${formatVolume(s.volumeKg, weightUnit)}${
          s.durationSec ? `, ${Math.round(s.durationSec / 60)} min` : ""
        }`
      );
    }
  }

  if (dataType === "bodycomp" || dataType === "progress" || dataType === "all") {
    const windowStartUtc = zonedTimeToUtc(start, "00:00", timeZone);
    const [checkIns, logs] = await Promise.all([
      BodyComp.find({
        userId,
        $or: [{ dateString: { $gte: start, $lte: today } }, { dateString: { $exists: false }, checkInDate: { $gte: windowStartUtc } }],
      })
        .sort({ checkInDate: 1 })
        .select("dateString checkInDate weight bodyFatPercent")
        .lean(),
      DailyLog.find({ userId, dateString: { $gte: start, $lt: today } }).select("dateString steps waterMl").lean(),
    ]);
    recordsCount += checkIns.length;

    const weighIns = checkIns.map((c) => ({
      date: c.dateString || localDateString(new Date(c.checkInDate), timeZone),
      weightKg: c.weight,
      bodyFat: c.bodyFatPercent,
    }));
    const trend = weightTrend(weighIns);
    const stepDays = logs.filter((l) => (l.steps || 0) > 0).map((l) => l.steps || 0);
    const waterDays = logs.filter((l) => (l.waterMl || 0) > 0).map((l) => l.waterMl || 0);
    const avgSteps = average(stepDays);
    const avgWater = average(waterDays);

    lines.push(
      "",
      `[BODY WEIGHT & ACTIVITY: ${start} to ${today}]`,
      trend
        ? `Weight: ${weight(trend.startKg)} on ${trend.startDate} -> ${weight(trend.endKg)} on ${trend.endDate} (change ${trend.deltaKg > 0 ? "+" : ""}${weight(trend.deltaKg)} over ${trend.spanDays} days${
            trend.weeklyRateKg !== null ? `, ${trend.weeklyRateKg > 0 ? "+" : ""}${weight(trend.weeklyRateKg)}/week` : ", too short to compute a weekly rate"
          }; ${trend.count} weigh-ins)`
        : `Weight trend: fewer than two weigh-ins in this period (${weighIns.filter((w) => w.weightKg).length} recorded)`,
      `Steps: ${avgSteps === null ? "no step data" : `${fmt(avgSteps)} average on ${stepDays.length} days with steps`} | Water: ${
        avgWater === null ? "no water logged" : `${fmt(avgWater)} ml average on ${waterDays.length} days with water`
      } (today excluded)`
    );
    if (weighIns.length > 0) {
      lines.push("[CHECK-INS]");
      for (const c of weighIns.slice(-8)) {
        lines.push(`${c.date}: ${c.weightKg ? weight(c.weightKg) : "no weight"}${c.bodyFat ? `, body fat ${c.bodyFat}%` : ""}`);
      }
    }
  }

  const textContext = lines.join("\n");
  const badgeLabels: Record<CoachDataType, string> = {
    meals: `Nutrition data, last ${days} days (${recordsCount} meals)`,
    workouts: `Training data, last ${days} days (${recordsCount} sessions)`,
    bodycomp: `Body weight data, last ${days} days`,
    progress: `Progress data, last ${days} days`,
    all: `All your data, last ${days} days`,
    today: "Today's data",
  };

  return {
    textContext,
    summary: {
      dataType,
      days,
      recordsCount,
      tokensEstimated: Math.round(textContext.length / 4),
      badgeLabel: badgeLabels[dataType],
    },
  };
}
