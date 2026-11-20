import Link from "next/link";
import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import { dailyTargets } from "@/lib/fitness/targets";
import { addDays, formatDateString, isValidDateString, localDateString, resolveTimeZone } from "@/lib/time";
import { listMealsForDay } from "@/lib/nutrition/meals";
import { EARLIEST_LOG_DATE } from "@/lib/nutrition/meal-time";
import { sumMacros } from "@/lib/nutrition/totals";
import { NutritionDateNavigator } from "@/components/nutrition/NutritionDateNavigator";
import { MacroRemainingCards, type MacroStatsData } from "@/components/nutrition/MacroRemainingCards";
import { MealListClient } from "@/components/nutrition/MealListClient";
import { AddMealButton } from "@/components/nutrition/AddMealButton";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Your meals, calories and macros for any day.",
};

interface NutritionPageProps {
  searchParams: Promise<{ date?: string | string[] }>;
}

export default async function NutritionPage({ searchParams }: NutritionPageProps) {
  const user = await requirePageUser();
  const userId = String(user._id);
  const tz = resolveTimeZone(user.preferences?.timezone);
  const todayStr = localDateString(new Date(), tz);

  const { date } = await searchParams;
  const requested = typeof date === "string" ? date : undefined;
  const selectedDate =
    requested && isValidDateString(requested) && requested <= todayStr && requested >= EARLIEST_LOG_DATE
      ? requested
      : todayStr;

  await getDb();
  const [meals, datesWithMeals] = await Promise.all([
    listMealsForDay(userId, selectedDate),
    Meal.distinct("dateString", {
      userId: user._id,
      dateString: { $gte: addDays(todayStr, -730), $lte: todayStr },
    }) as Promise<string[]>,
  ]);

  // Totals are the sum of the meals listed below, so the cards always match the list.
  const eaten = sumMacros(meals.map((meal) => meal.macros));
  // A target of 0 is shown as "No target set" (profile without weight and height).
  const targets = dailyTargets(user.fitnessProfile);
  const stats: MacroStatsData = {
    calories: { consumed: eaten.calories, target: targets.calories ?? 0 },
    protein: { consumed: eaten.protein, target: targets.protein ?? 0 },
    carbs: { consumed: eaten.carbs, target: targets.carbs ?? 0 },
    fat: { consumed: eaten.fat, target: targets.fat ?? 0 },
    fiber: { consumed: eaten.fiber, target: targets.fiber ?? 0 },
  };

  const isToday = selectedDate === todayStr;
  const dayLabel = isToday
    ? "today"
    : selectedDate === addDays(todayStr, -1)
      ? "yesterday"
      : formatDateString(selectedDate);
  const analyzeHref = isToday ? "/nutrition/analyze" : `/nutrition/analyze?date=${selectedDate}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Nutrition</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Meals, calories and macros for any day</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AddMealButton dateString={selectedDate} />
          <Link
            href={analyzeHref}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-semibold text-sm transition active:scale-95"
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>AI photo estimate</span>
          </Link>
        </div>
      </div>

      <NutritionDateNavigator selectedDate={selectedDate} todayStr={todayStr} datesWithMeals={datesWithMeals} />

      <MacroRemainingCards stats={stats} />

      <MealListClient key={selectedDate} meals={meals} selectedDate={selectedDate} dayLabel={dayLabel} isToday={isToday} />
    </div>
  );
}
