import React from "react";
import Link from "next/link";
import { Dumbbell, Home, Compass, ArrowLeft, Activity, UtensilsCrossed, Sparkles } from "lucide-react";

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 w-80 h-80 rounded-full bg-teal-500/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto text-center space-y-6 z-10">
        {/* Visual 404 Badge */}
        <div className="relative inline-flex items-center justify-center">
          <span className="text-8xl sm:text-9xl font-black tracking-tighter text-zinc-800/80 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-zinc-900/90 border border-emerald-500/40 flex items-center justify-center shadow-2xl shadow-emerald-500/20 backdrop-blur-xl">
              <Compass className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Page Off Track
          </h1>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
            The page you are looking for has been moved, completed, or does not exist in your routine.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition"
          >
            <Home className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <Link
            href="/workouts"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold border border-zinc-800 transition active:scale-[0.98]"
          >
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            <span>Workouts</span>
          </Link>
        </div>

        {/* Quick Shortcuts */}
        <div className="pt-6 border-t border-zinc-800/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-3">
            Quick Navigation
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/nutrition"
              className="p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/60 flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition group"
            >
              <UtensilsCrossed className="w-4 h-4 text-orange-400 group-hover:scale-110 transition" />
              <span>Nutrition</span>
            </Link>
            <Link
              href="/coach"
              className="p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/60 flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition group"
            >
              <Sparkles className="w-4 h-4 text-teal-400 group-hover:scale-110 transition" />
              <span>AI Coach</span>
            </Link>
            <Link
              href="/body-comp"
              className="p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/60 flex flex-col items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition group"
            >
              <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
              <span>Body Comp</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
