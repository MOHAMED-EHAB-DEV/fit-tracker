import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import { dailyTargets } from "@/lib/fitness/targets";
import { buildEnergySeries } from "@/lib/dashboard/energy";
import {
  addDays,
  formatDateString,
  isValidDateString,
  localDateString,
  normalizeWeekStart,
  resolveTimeZone,
  weekDatesOf,
} from "@/lib/time";
import { listMealsForDay } from "@/lib/nutrition/meals";
import { EARLIEST_LOG_DATE } from "@/lib/nutrition/meal-time";
import { DayNavigator } from "@/components/nutrition/DayNavigator";
import { EatDay } from "@/components/nutrition/EatDay";
import { EatNav } from "@/components/nutrition/EatNav";
import { EnergyBalanceChart } from "@/components/nutrition/EnergyBalanceChart";

export const metadata: Metadata = {
  title: "Eat",
  description: "Your meals, calories, macros and water for any day.",
};

interface NutritionPageProps {
  searchParams: Promise<{ date?: string | string[]; add?: string | string[] }>;
}

export default async function NutritionPage({ searchParams }: NutritionPageProps) {
  const user = await requirePageUser();
  const userId = String(user._id);
  const tz = resolveTimeZone(user.preferences?.timezone);
  const todayStr = localDateString(new Date(), tz);

  const { date, add } = await searchParams;
  const requested = typeof date === "string" ? date : undefined;
  const selectedDate =
    requested && isValidDateString(requested) && requested <= todayStr && requested >= EARLIEST_LOG_DATE
      ? requested
      : todayStr;
  const initialSheet = add === "scan" || add === "manual" ? add : null;
  const weekDates = weekDatesOf(selectedDate, normalizeWeekStart(user.preferences?.weekStartDay));

  await getDb();
  const [meals, datesWithMeals, logs] = await Promise.all([
    listMealsForDay(userId, selectedDate),
    Meal.distinct("dateString", {
      userId: user._id,
      dateString: { $gte: addDays(todayStr, -730), $lte: todayStr },
    }) as Promise<string[]>,
    DailyLog.find({ userId, dateString: { $in: weekDates } })
      .select("dateString caloriesIn caloriesOut macros steps waterMl")
      .lean(),
  ]);

  // A target of 0 means none (profile without weight and height).
  const targets = dailyTargets(user.fitnessProfile);
  const dayLog = logs.find((log) => log.dateString === selectedDate);
  const energySeries = buildEnergySeries({
    weekDates,
    todayDateString: todayStr,
    logs: logs.map((log) => ({
      dateString: log.dateString,
      caloriesIn: log.caloriesIn,
      caloriesOut: log.caloriesOut,
      macros: log.macros,
      steps: log.steps,
    })),
    bmr: targets.bmr,
    tdee: targets.tdee,
    targetCalories: targets.calories ?? null,
  });

  const dayLabel =
    selectedDate === todayStr ? "today" : selectedDate === addDays(todayStr, -1) ? "yesterday" : formatDateString(selectedDate);

  return (
    <div className="space-y-3">
      <EatNav current="day" />
      <EatDay
        key={selectedDate}
        meals={meals}
        selectedDate={selectedDate}
        todayStr={todayStr}
        dayLabel={dayLabel}
        targetCalories={targets.calories || null}
        targetProteinG={targets.protein || null}
        waterMl={dayLog?.waterMl ?? 0}
        waterGoalMl={user.preferences?.waterGoalMl ?? null}
        initialSheet={initialSheet}
        header={<DayNavigator selectedDate={selectedDate} todayStr={todayStr} datesWithMeals={datesWithMeals} />}
        aside={
          <EnergyBalanceChart
            data={energySeries}
            goal={user.fitnessProfile?.goal ?? null}
            targetCalories={targets.calories || null}
            tdee={targets.tdee}
          />
        }
      />
    </div>
  );
}
