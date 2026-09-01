import React, { Suspense } from "react";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { getUserCustomizedMacroTargets } from "@/lib/fitness/bmr";
import { Metadata } from "next";

import { NutritionDateNavigator } from "@/components/nutrition/NutritionDateNavigator";
import { MacroRemainingCards, MacroStatsData } from "@/components/nutrition/MacroRemainingCards";
import { MealListClient } from "@/components/nutrition/MealListClient";
import { MealData } from "@/components/nutrition/EditMealModal";

export const metadata: Metadata = {
  title: "Nutrition & Macro Log — AI Fit Tracker",
  description: "Track your daily calories, protein, carbs, fat, and fiber breakdown with customized targets.",
};

interface NutritionPageProps {
  searchParams: Promise<{ date?: string }>;
}

async function NutritionContent({ searchParams }: NutritionPageProps) {
  const user = await getFullUser();
  await getDb();

  const resolvedParams = await searchParams;
  const rawDate = resolvedParams?.date;
  const todayStr = getTodayDateString();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const selectedDateStr = rawDate && dateRegex.test(rawDate) ? rawDate : todayStr;

  const [dailyLog, meals] = await Promise.all([
    DailyLog.findOne({ userId: user?._id, dateString: selectedDateStr }).lean(),
    Meal.find({ userId: user?._id, dateString: selectedDateStr }).sort({ loggedAt: -1 }).lean(),
  ]);

  // Derive targets strictly customized from user settings & biometric profile
  const userTargets = getUserCustomizedMacroTargets(user);

  const caloriesIn = dailyLog?.caloriesIn || 0;
  const protein = dailyLog?.macros?.protein || 0;
  const carbs = dailyLog?.macros?.carbs || 0;
  const fat = dailyLog?.macros?.fat || 0;
  const fiber = dailyLog?.macros?.fiber || 0;

  const stats: MacroStatsData = {
    calories: {
      consumed: caloriesIn,
      target: userTargets.calories,
    },
    protein: {
      consumed: protein,
      target: userTargets.protein,
    },
    carbs: {
      consumed: carbs,
      target: userTargets.carbs,
    },
    fat: {
      consumed: fat,
      target: userTargets.fat,
    },
    fiber: {
      consumed: fiber,
      target: userTargets.fiber,
    },
  };

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

  const analyzeLinkUrl = selectedDateStr !== todayStr
    ? `/nutrition/analyze?date=${selectedDateStr}`
    : "/nutrition/analyze";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Nutrition & Macro Log
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Monitor caloric and macronutrient intake for any selected day
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={analyzeLinkUrl}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>AI Food Photo</span>
          </Link>
        </div>
      </div>

      {/* Date Navigation & Picker Bar */}
      <NutritionDateNavigator selectedDate={selectedDateStr} />

      {/* 5 Macro Target Cards with Remaining Calculations */}
      <MacroRemainingCards stats={stats} />

      {/* Interactive Meals List with Edit & Delete */}
      <MealListClient
        initialMeals={mappedMeals}
        selectedDate={selectedDateStr}
      />
    </div>
  );
}

export default async function NutritionPage({ searchParams }: NutritionPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading nutrition data...</span>
        </div>
      }
    >
      <NutritionContent searchParams={searchParams} />
    </Suspense>
  );
}
