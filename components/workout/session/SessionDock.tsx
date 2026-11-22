"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { formatDuration } from "@/lib/workouts/calc";
import { cn } from "@/lib/utils";

export interface RestState {
  /** Epoch milliseconds when the rest ends. */
  endsAt: number;
  totalSec: number;
}

/** A rest period of `restSec` seconds that starts now. */
export function restStartingNow(restSec: number): RestState {
  return { endsAt: Date.now() + restSec * 1000, totalSec: restSec };
}

let audioContext: AudioContext | null = null;

function beep(): void {
  try {
    const AudioCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    audioContext = audioContext || new AudioCtor();
    const context = audioContext;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.25, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.6);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
  } catch {
    // Sound is a bonus; the strip and vibration still signal the end.
  }
}

/** Seconds left on a rest, ticking (wall-clock based, so it survives a locked phone). */
function useRestClock(rest: RestState | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!rest) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [rest]);
  return rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
}

export interface SessionDockProps {
  rest: RestState | null;
  onRestChange: (rest: RestState | null) => void;
  undo: { label: string } | null;
  onUndo: () => void;
  /** Secondary action on the left (Finish); omitted when the primary is already the finish. */
  secondary?: { label: string; onClick: () => void; disabled?: boolean } | null;
  primary: { label: React.ReactNode; onClick: () => void; disabled?: boolean; isLoading?: boolean; ariaLabel?: string };
  /** Hidden while the keypad bar is up. */
  hidden?: boolean;
}

/**
 * The live workout's bottom dock (glass): the rest timer, or the 7-second
 * Undo strip with a compact rest countdown; then Finish and the primary
 * "Log set N · W × R". Publishes its height as --dock-height so toasts sit
 * just above it.
 */
export function SessionDock({ rest, onRestChange, undo, onUndo, secondary, primary, hidden = false }: SessionDockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const secondsLeft = useRestClock(rest);
  const finished = Boolean(rest) && secondsLeft <= 0;
  const announcedFor = useRef<number | null>(null);

  // The rest ended: beep, buzz, and hide the strip after a moment.
  useEffect(() => {
    if (!rest || !finished || announcedFor.current === rest.endsAt) return;
    announcedFor.current = rest.endsAt;
    // Only make noise if the rest ended just now, not when returning to an old one.
    if (Date.now() - rest.endsAt < 5000) {
      beep();
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // Vibration is not available everywhere.
      }
    }
    const hide = setTimeout(() => onRestChange(null), 4000);
    return () => clearTimeout(hide);
  }, [rest, finished, onRestChange]);

  // Room for the dock: toasts and the end of the page sit above it.
  useEffect(() => {
    const element = ref.current;
    const root = document.documentElement;
    if (!element || hidden) {
      root.style.setProperty("--dock-height", "0px");
      return;
    }
    const update = () => root.style.setProperty("--dock-height", `${Math.round(element.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--dock-height");
    };
  }, [hidden]);

  const adjust = (deltaSec: number) => {
    if (!rest) return;
    const base = Math.max(rest.endsAt, Date.now());
    const endsAt = Math.max(Date.now(), base + deltaSec * 1000);
    onRestChange({ endsAt, totalSec: Math.max(1, rest.totalSec + deltaSec) });
  };

  const chip =
    "inline-flex h-[34px] items-center justify-center rounded-chip border border-line bg-elevated px-2.5 font-mono text-[13px] font-medium text-ink transition-colors hover:border-line-strong cursor-pointer";

  return (
    <div
      ref={ref}
      className={cn(
        "glass-chrome fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] transition-transform duration-200 md:start-(--rail-width)",
        hidden && "pointer-events-none translate-y-full"
      )}
    >
      <div className="mx-auto max-w-[680px]">
        {undo ? (
          <div className="flex min-h-12 items-center justify-between gap-2 border-b border-(--glass-border) px-3 py-1.5">
            <span role="status" className="min-w-0 truncate text-sm text-ink">
              {undo.label}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {rest && !finished && (
                <span className="inline-flex h-[26px] items-center rounded-chip bg-accent-soft px-2 font-mono text-xs font-semibold tabular-nums text-accent">
                  <span className="sr-only">Rest </span>
                  {formatDuration(secondsLeft)}
                </span>
              )}
              <button type="button" onClick={onUndo} className="inline-flex min-h-11 items-center rounded-chip px-3 text-sm font-semibold text-accent hover:bg-elevated cursor-pointer">
                Undo
              </button>
            </span>
          </div>
        ) : (
          rest && (
            <div className="glass-live border-b border-(--glass-border) px-3 pt-2.5 pb-2">
              <ProgressTrack value={Math.max(0, secondsLeft)} max={rest.totalSec} size="sm" tone="accent" />
              <div className="mt-[7px] flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-ink-2">{finished ? "Rest over" : "Rest"}</span>
                  <span className="font-mono text-[21px] font-semibold tabular-nums tracking-[-0.02em] text-accent" aria-hidden="true">
                    {formatDuration(Math.max(0, secondsLeft))}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {!finished && (
                    <>
                      <button type="button" onClick={() => adjust(-15)} aria-label="15 seconds less rest" className={chip}>
                        -15s
                      </button>
                      <button type="button" onClick={() => adjust(15)} aria-label="15 seconds more rest" className={chip}>
                        +15s
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onRestChange(null)}
                    aria-label={finished ? "Dismiss rest timer" : "Skip rest"}
                    className={cn(chip, "font-sans text-ink-2")}
                  >
                    {finished ? "Close" : "Skip"}
                  </button>
                </div>
              </div>
              <p role="status" className="sr-only">
                {finished ? "Rest is over. Start your next set." : ""}
              </p>
            </div>
          )
        )}

        <div className={cn("grid gap-2.5 px-3 pt-2.5 pb-3", secondary ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
          {secondary && (
            <Button
              variant="secondary"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
              className="min-h-[46px] px-4 text-ink-2"
            >
              {secondary.label}
            </Button>
          )}
          <Button
            onClick={primary.onClick}
            disabled={primary.disabled}
            isLoading={primary.isLoading}
            aria-label={primary.ariaLabel}
            className="min-h-[46px] whitespace-nowrap"
          >
            {primary.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionDock;
