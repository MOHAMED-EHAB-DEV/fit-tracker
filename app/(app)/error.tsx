"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, LayoutDashboard, Dumbbell } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard / Feature Error:", error);
  }, [error]);

  return (
    <div className="w-full max-w-xl mx-auto py-12 px-4 select-none">
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl space-y-6 text-center backdrop-blur-xl relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-rose-500 via-amber-500 to-rose-500" />
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/30">
          <AlertCircle className="w-8 h-8 animate-pulse" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Failed to Load Section
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
            There was an issue synchronizing your fitness data for this view.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-zinc-400 bg-zinc-950/80 px-2.5 py-1 rounded-lg inline-block border border-zinc-800/80 mt-2">
              Ref: {error.digest}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Section</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition active:scale-[0.98]"
          >
            <LayoutDashboard className="w-4 h-4 text-emerald-400" />
            <span>Dashboard Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
