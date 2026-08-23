import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, Plus, UtensilsCrossed, Clock, Flame, Target, Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { Metadata } from "next";

import { MealListClient } from "@/components/nutrition/MealListClient";
import { MealData } from "@/components/nutrition/EditMealModal";

export const metadata: Metadata = {
  title: "Nutrition & Macros — AI Fit Tracker",
  description: "Track your daily calories, protein, carbs, and fat breakdown.",
};

async function NutritionContent() {
  const user = await getFullUser();
  await getDb();

  const todayStr = getTodayDateString();

  const [dailyLog, meals] = await Promise.all([
    DailyLog.findOne({ userId: user?._id, dateString: todayStr }).lean(),
    Meal.find({ userId: user?._id, dateString: todayStr }).sort({ loggedAt: -1 }).lean(),
  ]);

  const caloriesIn = dailyLog?.caloriesIn || 0;
  const targetCalories = user?.fitnessProfile?.targetCalories || user?.computed?.tdee || 2400;
  const protein = dailyLog?.macros?.protein || 0;
  const targetProtein = user?.fitnessProfile?.targetProteinG || user?.computed?.proteinTargetG || 160;
  const carbs = dailyLog?.macros?.carbs || 0;
  const fat = dailyLog?.macros?.fat || 0;

  const calPct = Math.min(100, Math.round((caloriesIn / targetCalories) * 100));
  const proteinPct = Math.min(100, Math.round((protein / targetProtein) * 100));

  const mappedMeals: MealData[] = meals.map((m: any) => ({
    _id: m._id.toString(),
    mealType: m.mealType,
    description: m.description,
    loggedAt: m.loggedAt ? new Date(m.loggedAt).toISOString() : new Date().toISOString(),
    macros: {
      calories: m.macros?.calories || 0,
      protein: m.macros?.protein || 0,
      carbs: m.macros?.carbs || 0,
      fat: m.macros?.fat || 0,
      fiber: m.macros?.fiber || 0,
    },
    cloudinary: m.cloudinary?.secureUrl ? { secureUrl: m.cloudinary.secureUrl } : null,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Nutrition & Macro Log
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Monitor today&apos;s caloric and macronutrient intake
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/nutrition/analyze"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>AI Food Photo</span>
          </Link>
        </div>
      </div>

      {/* Daily Macro Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calories Progress */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Energy
            </span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{caloriesIn.toLocaleString()}</span>
            <span className="text-xs text-zinc-500">/ {targetCalories.toLocaleString()} kcal</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${calPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{calPct}% of target</span>
            <span>{Math.max(0, targetCalories - caloriesIn)} kcal remaining</span>
          </div>
        </div>

        {/* Protein Progress */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Protein Target
            </span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{protein}g</span>
            <span className="text-xs text-zinc-500">/ {targetProtein}g</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{proteinPct}% hit</span>
            <span>{Math.max(0, targetProtein - protein)}g to go</span>
          </div>
        </div>

        {/* Macro Distribution */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Macronutrient Ratio
          </span>
          <div className="grid grid-cols-3 gap-2 text-center my-2">
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-emerald-400 font-semibold block">Protein</span>
              <span className="text-base font-bold text-white block mt-0.5">{protein}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-amber-400 font-semibold block">Carbs</span>
              <span className="text-base font-bold text-white block mt-0.5">{carbs}g</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-orange-400 font-semibold block">Fat</span>
              <span className="text-base font-bold text-white block mt-0.5">{fat}g</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 text-center">
            Calculated from today&apos;s {meals.length} logged meal{meals.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Interactive Meals List with Edit & Delete */}
      <MealListClient initialMeals={mappedMeals} />
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading nutrition data...</span>
        </div>
      }
    >
      <NutritionContent />
    </Suspense>
  );
}
