"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatDuration } from "@/lib/workouts/calc";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

const BAR_HEIGHT = "4rem";
const CHANGED_EVENT = "ft:active-session-changed";

/** Call after starting, finishing or discarding a workout without leaving the page. */
export function announceActiveSessionChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * "Workout in progress" bar, shown on every screen except the workout itself,
 * so a running workout is always one tap away and is never lost by
 * navigating around the app.
 */
export function ActiveSessionBar({ initial }: { initial: SessionSummaryDTO | null }) {
  const pathname = usePathname();
  const [active, setActive] = useState<SessionSummaryDTO | null>(initial);
  const [seenInitial, setSeenInitial] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const isFirstRun = useRef(true);

  // Fresh server data (after router.refresh()) replaces what the bar last knew.
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setActive(initial);
  }

  const onSessionScreen = pathname.startsWith("/workouts/session/");
  const isVisible = Boolean(active) && !onSessionScreen;
  const showClock = Boolean(active) && !active?.isPastLog;

  // The answer can change on any screen (started, finished, discarded, or
  // changed on another device), so it is re-read on navigation and on return.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const data = await api<{ session: SessionSummaryDTO | null }>("/api/sessions/active");
        if (!cancelled) setActive(data.session);
      } catch {
        // Offline: keep showing what we last knew.
      }
    };

    if (isFirstRun.current) isFirstRun.current = false;
    else void check();

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onChanged = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CHANGED_EVENT, onChanged);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isVisible || !showClock) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isVisible, showClock]);

  // Tell the layout how much room the bar takes, so it never covers content.
  useEffect(() => {
    const root = document.documentElement;
    if (isVisible) root.style.setProperty("--session-bar-height", BAR_HEIGHT);
    else root.style.removeProperty("--session-bar-height");
    return () => {
      root.style.removeProperty("--session-bar-height");
    };
  }, [isVisible]);

  if (!active || !isVisible) return null;

  const elapsedSec = Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1000));

  return (
    <div className="session-bar fixed inset-x-0 z-30 px-3 pointer-events-none md:inset-x-auto md:end-6 md:px-0">
      <Link
        href={`/workouts/session/${active.id}`}
        className="pointer-events-auto mx-auto flex min-h-14 max-w-md items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950 px-4 shadow-xl shadow-black/50 md:min-w-80"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-emerald-300">
            {active.isPastLog ? "Unfinished workout log" : "Workout in progress"}
          </span>
          <span className="block truncate text-sm font-semibold text-white">{active.name}</span>
        </span>
        {showClock && (
          // The server and the browser read the clock a moment apart.
          <span className="text-sm font-semibold tabular-nums text-white" aria-hidden="true" suppressHydrationWarning>
            {formatDuration(elapsedSec)}
          </span>
        )}
        <span className="flex items-center text-sm font-semibold text-emerald-300">
          Resume
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}

export default ActiveSessionBar;
