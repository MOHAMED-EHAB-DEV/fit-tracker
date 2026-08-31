import React from "react";
import Link from "next/link";
import { Dumbbell, ArrowLeft, Search, Plus } from "lucide-react";

export default function AppNotFound() {
  return (
    <div className="w-full max-w-xl mx-auto py-16 px-4 text-center select-none">
      <div className="p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-6 relative overflow-hidden shadow-2xl">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-400 mx-auto flex items-center justify-center">
          <Search className="w-8 h-8 text-emerald-400" />
        </div>

        {/* Text */}
        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Item or Record Not Found
          </h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
            The workout, meal log, or check-in you requested does not exist or was deleted.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/workouts"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition"
          >
            <Dumbbell className="w-4 h-4" />
            <span>View All Workouts</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
