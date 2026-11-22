"use client";

import { useEffect } from "react";
import { useDashboardFreshness } from "@/components/habits/useLiveToday";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { syncWidgetData } from "@/services/webview-bridge";

export interface TodayLiveProps {
  todayStr: string;
  timeZone: string;
  stats: {
    caloriesIn: number;
    targetCalories: number | null;
    steps: number;
    stepGoal: number | null;
    waterMl: number;
    waterGoalMl: number | null;
  };
  streak: { currentStreak: number; longestStreak: number; isLoggedToday: boolean };
}

/**
 * Keeps Today current and feeds the Android home-screen widgets: refreshes on
 * a new day or after the app comes back, and (inside the Android app) sends
 * today's numbers and the streak to the widgets. Renders nothing.
 */
export function TodayLive({ todayStr, timeZone, stats, streak }: TodayLiveProps) {
  const liveToday = useDashboardFreshness(todayStr, timeZone);
  const isNative = useIsNativeApp();
  const dayIsStale = liveToday !== todayStr;

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
  }, [
    isNative,
    dayIsStale,
    todayStr,
    stats.steps,
    stats.stepGoal,
    stats.caloriesIn,
    stats.targetCalories,
    stats.waterMl,
    stats.waterGoalMl,
  ]);

  useEffect(() => {
    syncWidgetData({
      streakDays: streak.currentStreak,
      longestStreak: streak.longestStreak,
      isLoggedToday: streak.isLoggedToday,
    });
  }, [streak.currentStreak, streak.longestStreak, streak.isLoggedToday]);

  return null;
}

export default TodayLive;
