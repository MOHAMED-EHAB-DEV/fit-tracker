import React from "react";
import { Dumbbell } from "lucide-react";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading application..."
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 select-none"
    >
      {/* Background ambient glow */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none animate-pulse-glow" />

      {/* Brand Icon with Pulsing Halo */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-3xl bg-linear-to-tr from-emerald-500 to-teal-400 blur-lg opacity-40 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-emerald-500/30 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
          <Dumbbell className="w-8 h-8 text-emerald-400 animate-bounce" style={{ animationDuration: "1.8s" }} />
        </div>
      </div>

      {/* App Title & Subtitle */}
      <div className="text-center space-y-1.5 z-10">
        <h1 className="text-lg font-black tracking-tight text-white flex items-center justify-center gap-1">
          Fit<span className="text-emerald-400">Tracker</span>
          <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ms-1">
            AI
          </span>
        </h1>
        <p className="text-xs text-zinc-400 font-medium tracking-wide">
          Powering your fitness intelligence...
        </p>
      </div>

      {/* Sleek Progress Indeterminate Bar */}
      <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden mt-6 border border-zinc-800/80 z-10">
        <div className="h-full w-full bg-linear-to-r from-emerald-500 via-teal-300 to-emerald-500 rounded-full animate-[shimmer_1.5s_infinite_linear] bg-size-[200%_100%]" />
      </div>
    </div>
  );
}
