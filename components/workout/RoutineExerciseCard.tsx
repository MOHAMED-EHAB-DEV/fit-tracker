"use client";

import React, { useState } from "react";
import { Trash2, Flame, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseInstructionsModal } from "@/components/workout/ExerciseInstructionsModal";

export interface DefaultExerciseItem {
  catalogId: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  warmupSets?: number;
  warmupReps?: number;
  warmupWeight?: number | null;
  notes?: string | null;
}

interface RoutineExerciseCardProps {
  exercise: DefaultExerciseItem;
  index: number;
  onUpdate: (updated: Partial<DefaultExerciseItem>) => void;
  onDelete: () => void;
}

export function RoutineExerciseCard({
  exercise,
  index,
  onUpdate,
  onDelete,
}: RoutineExerciseCardProps) {
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const currentUnit = exercise.weightUnit || "kg";
  const isWarmup = !!exercise.isWarmup;

  const handleToggleWarmup = () => {
    if (!isWarmup) {
      onUpdate({
        isWarmup: true,
        warmupSets: exercise.warmupSets || 1,
        warmupReps: exercise.warmupReps || 12,
        warmupWeight:
          exercise.warmupWeight ??
          (exercise.targetWeight ? Math.round(exercise.targetWeight * 0.5) : 20),
      });
    } else {
      onUpdate({ isWarmup: false });
    }
  };

  return (
    <>
      <article
        className={cn(
          "p-5 sm:p-6 rounded-[28px] bg-zinc-900/80 backdrop-blur-2xl border shadow-xl space-y-4 transition-all",
          isWarmup
            ? "border-amber-500/30 bg-linear-to-b from-amber-500/5 to-zinc-900/80 hover:border-amber-500/40"
            : "border-white/10 hover:border-white/20"
        )}
      >
        {/* Exercise Title, Instructions Button, Warmup Toggle, and Delete */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "w-7 h-7 rounded-xl border flex items-center justify-center font-bold text-xs",
                isWarmup
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-zinc-800 border-white/10 text-zinc-400"
              )}
            >
              {index + 1}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  {exercise.name}
                </h3>

                {/* Instructions Info button */}
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(true)}
                  className="p-1 rounded-lg bg-zinc-950/80 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer shadow-xs active:scale-95 group/info"
                  title="View exercise instructions & execution guide"
                >
                  <Info className="w-3.5 h-3.5 transition-transform group-hover/info:scale-110" />
                </button>

                {isWarmup && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Warmup Active
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold text-emerald-400">
                {exercise.muscleGroup}
              </span>
            </div>
          </div>

        <div className="flex items-center gap-2">
          {/* Warmup Toggle Button */}
          <button
            type="button"
            onClick={handleToggleWarmup}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border",
              isWarmup
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20"
                : "bg-zinc-950/60 text-zinc-400 border-white/8 hover:text-zinc-200 hover:border-white/15"
            )}
            title={isWarmup ? "Disable Warmup Sets" : "Activate Warmup Sets for this exercise"}
          >
            <Flame
              className={cn(
                "w-3.5 h-3.5",
                isWarmup ? "text-amber-400 fill-amber-400/40" : "text-zinc-500"
              )}
            />
            <span>{isWarmup ? "Warmup Option Active" : "Add Warmup"}</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-zinc-500 hover:text-red-400 transition cursor-pointer"
            title="Remove exercise from routine"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warmup Sets Configuration (Visible when Warmup is Active) */}
      {isWarmup && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Flame className="w-3 h-3 text-amber-400" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-amber-300">
                  Warmup Set(s) Configuration
                </h4>
                <p className="text-[10px] text-amber-200/70">
                  Prepended before your main working sets
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Warmup Sets Number */}
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block">
                Warmup Sets
              </span>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      warmupSets: Math.max(1, (exercise.warmupSets || 1) - 1),
                    })
                  }
                  className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                >
                  -
                </button>
                <span className="font-extrabold text-white text-sm">
                  {exercise.warmupSets || 1} Warmup {exercise.warmupSets === 1 ? "Set" : "Sets"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      warmupSets: Math.min(5, (exercise.warmupSets || 1) + 1),
                    })
                  }
                  className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center transition cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Target Warmup Reps */}
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block">
                Warmup Target Reps
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={exercise.warmupReps || 12}
                  onChange={(e) =>
                    onUpdate({
                      warmupReps: parseInt(e.target.value, 10) || 12,
                    })
                  }
                  className="w-full text-center py-1 px-2 bg-zinc-900 border border-amber-500/30 rounded-lg text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-300/70 font-bold">reps</span>
              </div>
            </div>

            {/* Target Warmup Weight */}
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block">
                Warmup Target Weight
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={exercise.warmupWeight ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      warmupWeight: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="e.g. 20"
                  className="w-full text-center py-1 px-2 bg-zinc-900 border border-amber-500/30 rounded-lg text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-300 font-extrabold uppercase shrink-0">
                  {currentUnit}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Working Target Controls Grid: Sets, Reps, Weight */}
      <div className="space-y-2 pt-2 border-t border-white/6">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <span>Main Working Sets</span>
          <div className="inline-flex rounded-lg bg-zinc-950/80 border border-white/10 p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => onUpdate({ weightUnit: "kg" })}
              className={cn(
                "px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition cursor-pointer",
                currentUnit === "kg"
                  ? "bg-emerald-500 text-zinc-950 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="Set unit to Kilograms (KG)"
            >
              KG
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ weightUnit: "lbs" })}
              className={cn(
                "px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition cursor-pointer",
                currentUnit === "lbs"
                  ? "bg-emerald-500 text-zinc-950 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="Set unit to Pounds (LBS)"
            >
              LBS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Target Sets */}
          <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Working Sets
            </span>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  onUpdate({ targetSets: Math.max(1, (exercise.targetSets || 3) - 1) })
                }
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
              >
                -
              </button>
              <span className="font-extrabold text-white text-base">
                {exercise.targetSets || 3} Sets
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdate({ targetSets: Math.min(10, (exercise.targetSets || 3) + 1) })
                }
                className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Target Reps */}
          <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Target Reps / Set
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                value={exercise.targetReps || 10}
                onChange={(e) =>
                  onUpdate({ targetReps: parseInt(e.target.value, 10) || 10 })
                }
                className="w-full text-center py-1.5 px-2 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs text-zinc-500 font-bold">reps</span>
            </div>
          </div>

          {/* Target Working Weight */}
          <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Target Weight
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                value={exercise.targetWeight ?? ""}
                onChange={(e) =>
                  onUpdate({ targetWeight: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g. 60"
                className="w-full text-center py-1.5 px-2 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-xs text-emerald-400 font-extrabold uppercase shrink-0">
                {currentUnit}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>

    {/* Exercise Instructions Modal */}
    <ExerciseInstructionsModal
      catalogId={exercise.catalogId}
      fallbackName={exercise.name}
      isOpen={showInstructionsModal}
      onClose={() => setShowInstructionsModal(false)}
    />
  </>
  );
}

export default RoutineExerciseCard;
