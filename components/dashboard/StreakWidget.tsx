"use client";

import React, { useEffect } from "react";
import { Flame, Award, Calendar, CheckCircle2, TrendingUp } from "lucide-react";
import { IStreakData } from "@/lib/fitness/streak";
import { syncWidgetData } from "@/services/webview-bridge";

interface StreakWidgetProps {
  streak: IStreakData;
}

export function StreakWidget({ streak }: StreakWidgetProps) {
  const {
    currentStreak,
    longestStreak,
    consistencyRate30d,
    isLoggedToday,
    nextMilestone,
    badgeTitle,
  } = streak;

  // Sync habit streak to native Android home screen widgets
  useEffect(() => {
    syncWidgetData({
      streakDays: currentStreak,
      longestStreak,
      isLoggedToday,
    });
  }, [currentStreak, longestStreak, isLoggedToday]);

  // Progress to next milestone percentage
  const progressPercent = Math.min(
    100,
    Math.round((currentStreak / Math.max(nextMilestone, 1)) * 100)
  );

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 shadow-lg backdrop-blur-md relative overflow-hidden group">
      {/* Background ambient glow when streak is active */}
      <div
        className={`absolute -top-12 -inset-e-12 w-32 h-32 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          currentStreak > 0 ? "bg-orange-500/15" : "bg-zinc-800/10"
        }`}
        aria-hidden="true"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition shadow-md ${
              currentStreak > 0
                ? "bg-linear-to-br from-orange-500 to-amber-500 text-zinc-950 shadow-orange-500/20"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"
            }`}
          >
            <Flame
              className={`w-5 h-5 ${currentStreak > 0 ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-base tracking-tight">
                {currentStreak} Day{currentStreak === 1 ? "" : "s"} Streak
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {badgeTitle}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isLoggedToday ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  Logged today — streak secured!
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  Log your food, water, or workout to keep streak alive!
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-2.5 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-1.5 text-zinc-400">
            <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Best: <strong className="text-zinc-200">{longestStreak}d</strong></span>
          </div>

          <div className="px-2.5 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-1.5 text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>30d Rate: <strong className="text-emerald-300">{consistencyRate30d}%</strong></span>
          </div>
        </div>
      </div>

      {/* Progress towards next milestone */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
          <span>Next milestone: {nextMilestone} Days</span>
          <span className="text-zinc-500">{currentStreak}/{nextMilestone}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Streak milestone progress: ${progressPercent}%`}
          className="w-full h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden"
        >
          <div
            className="h-full bg-linear-to-r from-orange-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default StreakWidget;
