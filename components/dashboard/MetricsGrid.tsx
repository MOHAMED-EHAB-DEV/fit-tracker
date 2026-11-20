"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Droplets, Flame, Footprints, RefreshCw, Target } from "lucide-react";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";
import { syncWidgetData } from "@/services/webview-bridge";
import { useDashboardFreshness } from "@/components/habits/useLiveToday";
import { goalProgress, liveCaloriesOut, stepCalories } from "@/lib/dashboard/metrics";

export interface MetricsGridStats {
  /** Today's food calories (DailyLog.caloriesIn, 0 when nothing logged). */
  caloriesIn: number;
  /** Today's tracked expenditure: trackedCaloriesOut(todayLog, bmr) from lib/dashboard/energy (not raised to the TDEE); null when unknown. */
  caloriesOut: number | null;
  /** The TDEE estimate the shown expenditure never drops below; null when unknown. */
  caloriesOutFloor: number | null;
  /** The user's calorie target; null when none is set (no invented default). */
  targetCalories: number | null;
  proteinG: number;
  targetProteinG: number | null;
  carbsG: number;
  fatG: number;
  /** Steps stored for today. */
  steps: number;
  stepGoal: number | null;
  waterMl: number;
  waterGoalMl: number | null;
}

export interface MetricsGridProps {
  stats: MetricsGridStats;
  /** Today ("YYYY-MM-DD", user zone) the stats belong to. */
  todayStr: string;
  /** The user's IANA zone (session.timezone). */
  timeZone: string;
}

const cardClass =
  "p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden flex flex-col justify-between shadow-sm";

function NoGoal({ label }: { label: string }) {
  return (
    <Link href="/settings" className="text-xs text-zinc-400 underline underline-offset-2 hover:text-white">
      Set a {label}
    </Link>
  );
}

export function MetricsGrid({ stats, todayStr, timeZone }: MetricsGridProps) {
  const liveToday = useDashboardFreshness(todayStr, timeZone);
  const dayIsStale = liveToday !== todayStr;
  const { isNative, steps: liveSteps, isSyncing, syncNow, sensorInfo } = useNativeStepTracker(stats.steps);

  // Live pedometer steps belong to the device's current day; never mix them into yesterday's numbers.
  const currentSteps = dayIsStale ? stats.steps : Math.max(stats.steps, liveSteps);
  const caloriesOut = liveCaloriesOut({
    storedCaloriesOut: stats.caloriesOut,
    floor: stats.caloriesOutFloor,
    storedSteps: stats.steps,
    liveSteps: currentSteps,
  });

  const calories = goalProgress(stats.caloriesIn, stats.targetCalories);
  const protein = goalProgress(stats.proteinG, stats.targetProteinG);
  const steps = goalProgress(currentSteps, stats.stepGoal);
  const water = goalProgress(stats.waterMl, stats.waterGoalMl);

  useEffect(() => {
    if (!isNative || dayIsStale) return;
    syncWidgetData({
      date: todayStr,
      // The app itself shows the higher of this and its own count.
      steps: stats.steps,
      stepGoal: stats.stepGoal ?? undefined,
      caloriesIn: stats.caloriesIn,
      targetCalories: stats.targetCalories ?? undefined,
      waterMl: stats.waterMl,
      waterGoalMl: stats.waterGoalMl ?? undefined,
    });
  }, [isNative, dayIsStale, todayStr, stats.steps, stats.stepGoal, stats.caloriesIn, stats.targetCalories, stats.waterMl, stats.waterGoalMl]);

  return (
    <section aria-label="Today's nutrition and activity" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 2xl:gap-6">
      {/* Calories */}
      <article className={cardClass}>
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Calories</h3>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-orange-500/15 text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 flex-wrap">
            <span className={`text-xl sm:text-2xl md:text-3xl font-extrabold ${calories.isOver ? "text-red-400" : "text-white"}`}>
              {stats.caloriesIn.toLocaleString()}
            </span>
            {stats.targetCalories !== null && (
              <span className="text-xs text-zinc-400">/ {stats.targetCalories.toLocaleString()} kcal</span>
            )}
          </div>
        </div>
        <div>
          {calories.percent !== null ? (
            <>
              <div
                role="progressbar"
                aria-valuenow={calories.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={
                  calories.isOver
                    ? `${calories.percent}% of target, ${calories.overBy} kcal over`
                    : `${calories.percent}% of target`
                }
                aria-label="Calories eaten vs target"
                className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${calories.isOver ? "bg-red-500" : "bg-linear-to-r from-orange-500 to-amber-400"}`}
                  style={{ width: `${calories.barPercent}%` }}
                />
              </div>
              <p className={`text-xs mt-2 ${calories.isOver ? "text-red-400 font-semibold" : "text-zinc-400"}`}>
                {calories.isOver
                  ? `${calories.percent}% · ${calories.overBy.toLocaleString()} kcal over`
                  : `${calories.percent}% · ${calories.remaining.toLocaleString()} left`}
              </p>
            </>
          ) : (
            <NoGoal label="calorie target" />
          )}
          {caloriesOut !== null && (
            <p className="text-xs text-zinc-400 mt-1">Burned ≈ {caloriesOut.toLocaleString()} kcal</p>
          )}
        </div>
      </article>

      {/* Protein */}
      <article className={cardClass}>
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Protein</h3>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 flex-wrap">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">{Math.round(stats.proteinG)}g</span>
            {stats.targetProteinG !== null && (
              <span className="text-xs text-zinc-400">/ {Math.round(stats.targetProteinG)}g</span>
            )}
          </div>
        </div>
        <div>
          {protein.percent !== null ? (
            <div
              role="progressbar"
              aria-valuenow={protein.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Protein eaten vs target"
              className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
            >
              <div className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${protein.barPercent}%` }} />
            </div>
          ) : (
            <NoGoal label="protein target" />
          )}
          <div className="flex justify-between items-center text-xs text-zinc-400 mt-2">
            <span>C {Math.round(stats.carbsG)}g</span>
            <span>F {Math.round(stats.fatG)}g</span>
          </div>
        </div>
      </article>

      {/* Steps */}
      <article className={cardClass}>
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Steps</h3>
              {isNative && (
                <span
                  title={sensorInfo ? `Sensor: ${sensorInfo.name} (${sensorInfo.vendor})` : "Phone pedometer"}
                  className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20"
                >
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="hidden sm:inline">Pedometer</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={isSyncing}
              aria-label="Refresh step count"
              className="-m-1.5 w-11 h-11 flex items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Footprints className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 flex-wrap">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">{currentSteps.toLocaleString()}</span>
            {stats.stepGoal !== null && <span className="text-xs text-zinc-400">/ {stats.stepGoal.toLocaleString()}</span>}
          </div>
        </div>
        <div>
          {steps.percent !== null ? (
            <div
              role="progressbar"
              aria-valuenow={steps.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Steps vs goal"
              className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
            >
              <div className="h-full bg-linear-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${steps.barPercent}%` }} />
            </div>
          ) : (
            <NoGoal label="step goal" />
          )}
          <div className="flex justify-between items-center text-xs text-zinc-400 mt-2">
            <span>{steps.percent !== null ? `${steps.percent}%` : ""}</span>
            <span>≈ {stepCalories(currentSteps)} kcal</span>
          </div>
        </div>
      </article>

      {/* Water */}
      <article className={cardClass}>
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Water</h3>
            <div aria-hidden="true" className="p-1.5 sm:p-2 rounded-2xl bg-cyan-500/15 text-cyan-400">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 sm:gap-2 mb-2 flex-wrap">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">{(stats.waterMl / 1000).toFixed(1)} L</span>
            {stats.waterGoalMl !== null && <span className="text-xs text-zinc-400">/ {(stats.waterGoalMl / 1000).toFixed(1)} L</span>}
          </div>
        </div>
        <div>
          {water.percent !== null ? (
            <div
              role="progressbar"
              aria-valuenow={water.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Water vs goal"
              className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
            >
              <div className="h-full bg-linear-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${water.barPercent}%` }} />
            </div>
          ) : (
            <NoGoal label="water goal" />
          )}
          <div className="flex justify-between items-center text-xs text-zinc-400 mt-2">
            <span>{water.percent !== null ? `${water.percent}%` : ""}</span>
            <span>{stats.waterMl.toLocaleString()} ml</span>
          </div>
        </div>
      </article>
    </section>
  );
}

export default MetricsGrid;
