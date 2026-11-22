"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { api } from "@/lib/client/api";
import { formatDuration } from "@/lib/workouts/calc";
import { isFocusModePath } from "@/constants/navigation";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

/** Hairline + 2px progress line + 52px row. */
const BAR_HEIGHT = "55px";
const CHANGED_EVENT = "ft:active-session-changed";

/** Call after starting, finishing or discarding a workout without leaving the page. */
export function announceActiveSessionChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Seconds left on the rest timer the session screen keeps in storage (ft:rest:<id>), or null. */
function restSecondsLeft(sessionId: string, now: number): number | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(`ft:rest:${sessionId}`) || "null") as {
      endsAt?: number;
    } | null;
    if (!stored || typeof stored.endsAt !== "number") return null;
    const left = Math.ceil((stored.endsAt - now) / 1000);
    return left > 0 ? left : null;
  } catch {
    return null;
  }
}

/**
 * The minimised workout: a glass bar docked above the tab bar on every screen
 * except the workout itself ("Upper body A · 24:10 · 5 / 18 sets", the rest
 * countdown, expand), so a running workout is always one tap away.
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

  const isVisible = Boolean(active) && !isFocusModePath(pathname);
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
  const { completedSets, totalSets } = active.totals;
  const progress = totalSets > 0 ? Math.min(1, completedSets / totalSets) : 0;
  const rest = showClock ? restSecondsLeft(active.id, now) : null;

  return (
    <div className="session-bar fixed inset-x-0 z-30 md:start-(--rail-width)">
      <Link
        href={`/workouts/session/${active.id}`}
        aria-label={`Resume ${active.name}${active.isPastLog ? " (unfinished workout log)" : ""}`}
        className="glass-chrome glass-live block"
      >
        <div className="h-0.5 w-full bg-elevated" aria-hidden="true">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mx-auto flex h-[52px] max-w-[1120px] items-center justify-between gap-2.5 px-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent animate-live" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{active.name}</p>
              <p className="truncate font-mono text-xs tabular-nums text-ink-2" suppressHydrationWarning>
                {active.isPastLog ? "Unfinished log" : formatDuration(elapsedSec)} · {completedSets} / {totalSets} sets
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The rest timer lives in this device's storage, which the server cannot
                see: rendering it in the browser only keeps the first render identical. */}
            {rest !== null && (
              <ClientOnly>
                <span className="inline-flex h-[26px] items-center rounded-chip bg-accent-soft px-2 font-mono text-xs font-semibold tabular-nums text-accent">
                  <span className="sr-only">Rest </span>
                  {formatDuration(rest)}
                </span>
              </ClientOnly>
            )}
            <ChevronUp className="h-4 w-4 text-ink-2" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </div>
  );
}

export default ActiveSessionBar;
