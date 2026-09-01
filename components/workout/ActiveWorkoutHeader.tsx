"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Flame } from "lucide-react";
import { formatWeight } from "@/lib/fitness/units";
import { cn } from "@/lib/utils";

interface ActiveWorkoutHeaderProps {
  workoutId: string;
  name: string;
  dayOfWeek: string;
  weightUnit: "kg" | "lbs";
  isSaving: boolean;
  totalVolumeKg: number;
  completedSetsCount: number;
  totalSetsCount: number;
  exercisesCount: number;
  burnedCalories: number;
  onWeightUnitChange: (unit: "kg" | "lbs") => void;
  onFinish: () => Promise<void>;
}

export function ActiveWorkoutHeader({
  workoutId,
  name,
  dayOfWeek,
  weightUnit,
  isSaving,
  totalVolumeKg,
  completedSetsCount,
  totalSetsCount,
  exercisesCount,
  burnedCalories,
  onWeightUnitChange,
  onFinish,
}: ActiveWorkoutHeaderProps) {
  const dayCapitalized = dayOfWeek
    ? dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
    : "Saturday";

  return (
    <header className="p-6 rounded-[28px] bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/workouts/${workoutId}`}
            className="p-2.5 rounded-2xl bg-zinc-950/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Back to Routine Builder"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Gym Session Log
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                {dayCapitalized}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Per-Routine Weight Switcher (KG / LBS) */}
          <div
            role="group"
            aria-label="Workout measurement unit"
            className="inline-flex items-center p-1 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-inner"
          >
            <button
              type="button"
              onClick={() => onWeightUnitChange("kg")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer",
                weightUnit === "kg"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              KG
            </button>
            <button
              type="button"
              onClick={() => onWeightUnitChange("lbs")}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer",
                weightUnit === "lbs"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              LBS
            </button>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onFinish}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Save & Finish</span>
          </button>
        </div>
      </div>

      {/* Live In-Gym Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-3 border-t border-white/6 text-center">
        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Lifted Volume
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-400">
            {formatWeight(totalVolumeKg, weightUnit)}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Sets Done
          </span>
          <span className="text-base sm:text-lg font-black text-white">
            {completedSetsCount} <span className="text-xs font-semibold text-zinc-500">/ {totalSetsCount}</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center justify-center gap-1">
            <Flame className="w-3 h-3" />
            <span>Calories Burned</span>
          </span>
          <span className="text-base sm:text-lg font-black text-orange-400">
            {burnedCalories} <span className="text-xs font-semibold text-zinc-500">kcal</span>
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Exercises
          </span>
          <span className="text-base sm:text-lg font-black text-teal-300">
            {exercisesCount}
          </span>
        </div>
      </div>
    </header>
  );
}

export default ActiveWorkoutHeader;
