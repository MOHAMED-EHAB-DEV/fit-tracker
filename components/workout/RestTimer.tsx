"use client";

import React, { useState, useEffect } from "react";
import { Timer, Plus, SkipForward, Volume2 } from "lucide-react";

interface RestTimerProps {
  initialSeconds?: number;
  onFinish?: () => void;
}

export function RestTimer({ initialSeconds = 90, onFinish }: RestTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setTotalSeconds(initialSeconds);
    setRemaining(initialSeconds);
    setIsActive(true);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isActive || remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          playChime();
          onFinish?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, remaining, onFinish]);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("Audio chime playback error:", e);
    }
  };

  const addTime = (secs: number) => {
    setRemaining((prev) => prev + secs);
    setTotalSeconds((prev) => prev + secs);
  };

  const skipTimer = () => {
    setRemaining(0);
    setIsActive(false);
    onFinish?.();
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;

  if (remaining <= 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-xl shadow-emerald-950/20">
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-emerald-400 transition-all duration-1000 stroke-current"
              strokeWidth="3.5"
              strokeDasharray={`${progress}, 100`}
              strokeLinecap="round"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <Timer className="w-5 h-5 text-emerald-400 absolute" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
            Resting
          </span>
          <span className="text-xl font-extrabold text-white font-mono">
            {mins}:{secs < 10 ? `0${secs}` : secs}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => addTime(30)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+30s</span>
        </button>

        <button
          onClick={skipTimer}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
        >
          <SkipForward className="w-3.5 h-3.5" />
          <span>Skip</span>
        </button>
      </div>
    </div>
  );
}

export default RestTimer;
