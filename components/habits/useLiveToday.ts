"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { claimRefresh, consumeDashboardStale } from "@/lib/dashboard/stale";

interface LiveTodayOptions {
  /** Called once when the calendar day (user zone) changes while the page is open. */
  onDayChange?: (today: string, previous: string) => void;
  /** Called when the page becomes visible again after at least `resumeAfterMs` hidden. */
  onResume?: () => void;
  resumeAfterMs?: number;
}

/**
 * The user's current calendar day, kept live: re-checked when the app comes
 * back to the foreground (visibilitychange / pageshow / focus) and once a
 * minute while visible. A WebView left open overnight therefore never keeps
 * writing to yesterday.
 */
export function useLiveToday(serverToday: string, timeZone: string, options: LiveTodayOptions = {}): string {
  const [today, setToday] = useState(serverToday);
  const [prevServerToday, setPrevServerToday] = useState(serverToday);
  if (serverToday !== prevServerToday) {
    // A refreshed server render is the source of truth again.
    setPrevServerToday(serverToday);
    setToday(serverToday);
  }

  const todayRef = useRef(today);
  const optionsRef = useRef(options);
  useEffect(() => {
    todayRef.current = today;
    optionsRef.current = options;
  });

  useEffect(() => {
    let hiddenAt: number | null = null;

    const check = () => {
      const now = getTodayDateString(new Date(), timeZone);
      const previous = todayRef.current;
      if (now !== previous) {
        todayRef.current = now;
        setToday(now);
        optionsRef.current.onDayChange?.(now, previous);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      check();
      const threshold = optionsRef.current.resumeAfterMs ?? 5 * 60_000;
      if (away >= threshold) optionsRef.current.onResume?.();
    };

    const initial = window.setTimeout(check, 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, 60_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
    };
  }, [timeZone]);

  return today;
}

/**
 * For server-rendered dashboard widgets: refreshes the route when the day
 * changes, when the app resumes after a while, and on mount when another page
 * changed dashboard data (Back navigation shows the cached render otherwise).
 */
export function useDashboardFreshness(serverToday: string, timeZone: string): string {
  const router = useRouter();
  const refresh = () => {
    if (claimRefresh()) router.refresh();
  };
  const today = useLiveToday(serverToday, timeZone, { onDayChange: refresh, onResume: refresh });

  useEffect(() => {
    if (consumeDashboardStale() && claimRefresh()) router.refresh();
  }, [router]);

  return today;
}
