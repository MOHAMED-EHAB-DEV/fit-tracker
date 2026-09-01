"use client";

import React from "react";
import { Flame, Footprints, Droplets, Target, RefreshCw } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";

interface MetricsGridProps {
  stats: {
    caloriesIn: number;
    caloriesOut: number;
    targetCalories: number;
    proteinG: number;
    targetProteinG: number;
    carbsG: number;
    targetCarbsG: number;
    fatG: number;
    targetFatG: number;
    steps: number;
    stepGoal: number;
    waterMl: number;
    waterGoalMl: number;
  };
}

export function MetricsGrid({ stats }: MetricsGridProps) {
  const { user } = useUser();
  const { isNative, steps: liveSteps, isSyncing, syncNow, sensorInfo } = useNativeStepTracker(stats.steps);

  const calorieGoal = stats.targetCalories || user?.fitnessProfile?.targetCalories || user?.computed?.tdee || 2400;
  const proteinGoal = stats.targetProteinG || user?.fitnessProfile?.targetProteinG || user?.computed?.proteinTargetG || 160;
  const stepGoal = stats.stepGoal || user?.preferences?.stepGoal || 10000;
  const waterGoal = stats.waterGoalMl || user?.preferences?.waterGoalMl || 3000;

  const currentSteps = Math.max(stats.steps, liveSteps);
  const liveStepCalories = Math.round(currentSteps * 0.04);
  const baseOut = stats.caloriesOut - Math.round(stats.steps * 0.04);
  const dynamicCaloriesOut = Math.max(stats.caloriesOut, baseOut + liveStepCalories);

  const caloriePct = Math.min(100, Math.round((stats.caloriesIn / calorieGoal) * 100));
  const proteinPct = Math.min(100, Math.round((stats.proteinG / proteinGoal) * 100));
  const stepPct = Math.min(100, Math.round((currentSteps / stepGoal) * 100));
  const waterPct = Math.min(100, Math.round((stats.waterMl / waterGoal) * 100));

  return (
    <section aria-label="Today's Core Nutrition and Activity Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 2xl:gap-6">
      {/* Calories Card */}
      <article className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/60 transition flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Calories
            </span>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-orange-500/15 text-orange-400">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate">
              {stats.caloriesIn.toLocaleString()}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 truncate">/ {calorieGoal.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div
            role="progressbar"
            aria-valuenow={caloriePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Caloric intake progress"
            className="w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-linear-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${caloriePct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-zinc-400 mt-2">
            <span>{caloriePct}% target</span>
            <span className="hidden sm:inline">Burned: {dynamicCaloriesOut.toLocaleString()}</span>
          </div>
        </div>
      </article>

      {/* Protein Card */}
      <article className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/60 transition flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Protein
            </span>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate">
              {Number(stats.proteinG).toFixed(1)}g
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 truncate">/ {Number(proteinGoal).toFixed(1)}g</span>
          </div>
        </div>
        <div>
          <div
            role="progressbar"
            aria-valuenow={proteinPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily protein intake progress"
            className="w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-zinc-400 mt-2">
            <span>C: {Number(stats.carbsG).toFixed(1)}g</span>
            <span>F: {Number(stats.fatG).toFixed(1)}g</span>
          </div>
        </div>
      </article>

      {/* Steps Card (Live Native Reactive Integration) */}
      <article className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/60 transition flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Daily Steps
              </span>
              {isNative && (
                <span
                  title={sensorInfo ? `Hardware: ${sensorInfo.name} (${sensorInfo.vendor})` : "Hardware DSP Sensor"}
                  className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="hidden sm:inline">Pedometer</span>
                </span>
              )}
            </div>
            <button
              onClick={() => syncNow()}
              disabled={isSyncing}
              title="Sync latest steps"
              aria-label="Refresh step count"
              className="p-1.5 sm:p-2 rounded-2xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-300" />
              ) : (
                <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate">
              {currentSteps.toLocaleString()}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 truncate">/ {stepGoal.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div
            role="progressbar"
            aria-valuenow={stepPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily steps progress"
            className="w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-linear-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${stepPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-zinc-400 mt-2">
            <span>{stepPct}%</span>
            <span>~{liveStepCalories} kcal</span>
          </div>
        </div>
      </article>

      {/* Water Card */}
      <article className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden group hover:border-zinc-700/60 transition flex flex-col justify-between shadow-sm">
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Hydration
            </span>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-cyan-500/15 text-cyan-400">
              <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate">
              {(stats.waterMl / 1000).toFixed(1)}L
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 truncate">/ {(waterGoal / 1000).toFixed(1)}L</span>
          </div>
        </div>
        <div>
          <div
            role="progressbar"
            aria-valuenow={waterPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Hydration progress"
            className="w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-linear-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${waterPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-zinc-400 mt-2">
            <span>{waterPct}%</span>
            <span>{stats.waterMl} ml</span>
          </div>
        </div>
      </article>
    </section>
  );
}

export default MetricsGrid;
