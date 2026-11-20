"use client";

import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus, SkipForward, Timer } from "lucide-react";
import { formatDuration } from "@/lib/workouts/calc";

export interface RestState {
  /** Epoch milliseconds when the rest ends. */
  endsAt: number;
  totalSec: number;
}

interface RestTimerBarProps {
  rest: RestState | null;
  onChange: (rest: RestState | null) => void;
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
    // Sound is a bonus; the bar and vibration still signal the end.
  }
}

/**
 * Rest countdown. It counts against the clock (an end time), not ticks, so it
 * stays correct when the phone is locked or the app is in the background.
 */
export function RestTimerBar({ rest, onChange }: RestTimerBarProps) {
  const [now, setNow] = useState(() => Date.now());
  const announcedFor = useRef<number | null>(null);

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

  const remainingMs = rest ? rest.endsAt - now : 0;
  const finished = Boolean(rest) && remainingMs <= 0;

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
    const hide = setTimeout(() => onChange(null), 4000);
    return () => clearTimeout(hide);
  }, [rest, finished, onChange]);

  if (!rest) return null;

  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = rest.totalSec > 0 ? Math.min(100, Math.max(0, (remainingSec / rest.totalSec) * 100)) : 0;

  const adjust = (deltaSec: number) => {
    const base = Math.max(rest.endsAt, Date.now());
    const endsAt = Math.max(Date.now(), base + deltaSec * 1000);
    onChange({ endsAt, totalSec: Math.max(1, rest.totalSec + deltaSec) });
  };

  const control =
    "grid place-items-center w-11 h-11 rounded-xl bg-surface-2 text-white active:bg-zinc-700 cursor-pointer";

  return (
    <div className="fixed inset-x-0 bottom-above-nav z-30 px-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md overflow-hidden rounded-2xl border border-line bg-zinc-900 shadow-xl shadow-black/50">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Timer className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-400">{finished ? "Rest over" : "Rest"}</p>
            <p className="text-xl font-bold text-white tabular-nums" aria-hidden="true">
              {formatDuration(remainingSec)}
            </p>
          </div>
          {!finished && (
            <>
              <button type="button" onClick={() => adjust(-15)} aria-label="15 seconds less rest" className={control}>
                <Minus className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => adjust(15)} aria-label="15 seconds more rest" className={control}>
                <Plus className="w-5 h-5" aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={finished ? "Dismiss rest timer" : "Skip rest"}
            className={control}
          >
            <SkipForward className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="h-1 bg-surface-2" aria-hidden="true">
          <div className="h-full bg-emerald-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
        <p role="status" className="sr-only">
          {finished ? "Rest is over. Start your next set." : ""}
        </p>
      </div>
    </div>
  );
}

export default RestTimerBar;
