"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Dumbbell, Camera, Sparkles, Zap } from "lucide-react";

const QuickLogModal = dynamic(
  () => import("@/components/dashboard/QuickLogModal").then((mod) => mod.QuickLogModal),
  { ssr: false }
);

interface DashboardClientHeaderProps {
  userName: string;
  waterMl: number;
}

export function DashboardClientHeader({
  userName,
  waterMl,
}: DashboardClientHeaderProps) {
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Hello, {userName} 👋
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Here&apos;s your daily fitness & nutrition overview
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Log Button */}
          <button
            type="button"
            onClick={() => setIsQuickLogOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700/80 text-emerald-400 font-bold text-xs border border-zinc-700 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-emerald-400" />
            <span>Quick Log</span>
          </button>

          {/* Start Workout */}
          <Link
            href="/workouts/new"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Dumbbell className="w-4 h-4" />
            <span>Start Workout</span>
          </Link>

          {/* Snap Meal */}
          <Link
            href="/nutrition/analyze"
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-semibold border border-zinc-700 transition active:scale-95"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            <span className="hidden sm:inline">Snap Meal</span>
          </Link>

          {/* AI Coach */}
          <Link
            href="/coach"
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">AI Coach</span>
          </Link>
        </div>
      </div>

      {/* Quick Log Modal */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialWaterMl={waterMl}
      />
    </>
  );
}

export default DashboardClientHeader;
