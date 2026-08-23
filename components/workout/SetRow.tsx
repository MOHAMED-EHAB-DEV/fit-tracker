"use client";

import React from "react";
import { Check, Trophy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetData {
  setNumber: number;
  targetReps?: number | null;
  targetWeight?: number | null;
  completedReps?: number | null;
  weight?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  isPR?: boolean;
  completedAt?: string | null;
}

interface SetRowProps {
  set: SetData;
  index: number;
  unit?: "kg" | "lbs";
  onChange: (updated: Partial<SetData>) => void;
  onDelete: () => void;
  onComplete: () => void;
}

export function SetRow({
  set,
  index,
  unit = "kg",
  onChange,
  onDelete,
  onComplete,
}: SetRowProps) {
  const isCompleted = !!set.completedAt;

  const handleToggleComplete = () => {
    if (isCompleted) {
      onChange({ completedAt: null });
    } else {
      onChange({ completedAt: new Date().toISOString() });
      onComplete();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 sm:gap-3 py-1.5 sm:py-2 px-2 sm:px-2.5 rounded-xl transition-all duration-200",
        isCompleted
          ? "bg-emerald-500/10 border border-emerald-500/20 text-white"
          : set.isWarmup
          ? "bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/30 text-zinc-300"
          : "bg-zinc-950/60 border border-white/8 hover:border-white/15 text-zinc-300"
      )}
    >
      {/* Set Number / Warmup Badge */}
      <div className="w-5 sm:w-7 text-center shrink-0 flex items-center justify-center">
        {set.isWarmup ? (
          <span
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-[10px] sm:text-xs flex items-center justify-center"
            title="Warmup Set (excluded from 1RM / PR records)"
            aria-label={`Warmup Set ${index + 1}`}
          >
            W
          </span>
        ) : (
          <span className="font-bold text-xs text-zinc-400" aria-label={`Set ${index + 1}`}>{index + 1}</span>
        )}
      </div>

      {/* Previous / Target ghost data */}
      <div className="hidden sm:block w-20 sm:w-24 text-center shrink-0">
        <span
          className={cn(
            "text-[11px] sm:text-xs font-mono tabular-nums",
            set.isWarmup ? "text-amber-300/70" : "text-zinc-500"
          )}
        >
          {set.targetWeight ? `${set.targetWeight}${unit} × ${set.targetReps || 0}` : "—"}
        </span>
      </div>

      {/* Weight Input */}
      <div className="flex-1 min-w-14 sm:min-w-17.5">
        <div className="relative">
          <input
            type="number"
            step="0.5"
            aria-label={`Set ${index + 1} weight in ${unit}`}
            value={set.weight ?? ""}
            onChange={(e) =>
              onChange({ weight: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder={set.targetWeight ? String(set.targetWeight) : unit}
            className={cn(
              "w-full text-center py-1 sm:py-1.5 px-1 sm:px-2 min-h-[36px] bg-zinc-900 border rounded-xl text-white font-bold text-xs sm:text-sm tabular-nums focus:outline-none focus-visible:ring-2",
              set.isWarmup
                ? "border-amber-500/30 focus-visible:ring-amber-500/50"
                : "border-white/10 focus-visible:ring-emerald-500/50"
            )}
          />
        </div>
      </div>

      {/* Reps Input */}
      <div className="flex-1 min-w-12 sm:min-w-15">
        <div className="relative">
          <input
            type="number"
            aria-label={`Set ${index + 1} completed reps`}
            value={set.completedReps ?? ""}
            onChange={(e) =>
              onChange({ completedReps: e.target.value ? parseInt(e.target.value, 10) : null })
            }
            placeholder={set.targetReps ? String(set.targetReps) : "reps"}
            className={cn(
              "w-full text-center py-1 sm:py-1.5 px-1 sm:px-2 min-h-[36px] bg-zinc-900 border rounded-xl text-white font-bold text-xs sm:text-sm tabular-nums focus:outline-none focus-visible:ring-2",
              set.isWarmup
                ? "border-amber-500/30 focus-visible:ring-amber-500/50"
                : "border-white/10 focus-visible:ring-emerald-500/50"
            )}
          />
        </div>
      </div>

      {/* RPE Input */}
      <div className="w-12 sm:w-14 shrink-0 hidden md:block">
        <input
          type="number"
          min="1"
          max="10"
          step="0.5"
          aria-label={`Set ${index + 1} RPE`}
          value={set.rpe ?? ""}
          onChange={(e) =>
            onChange({ rpe: e.target.value ? parseFloat(e.target.value) : null })
          }
          placeholder="RPE"
          className="w-full text-center py-1 sm:py-1.5 px-1 min-h-[36px] bg-zinc-900 border border-white/10 rounded-xl text-zinc-300 text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        />
      </div>

      {/* PR Badge */}
      {set.isPR && (
        <div className="p-1 sm:p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0" title="Personal Record!" aria-label="Personal Record achieved">
          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
        </div>
      )}

      {/* Complete Checkmark Button */}
      <button
        type="button"
        onClick={handleToggleComplete}
        aria-pressed={isCompleted}
        aria-label={isCompleted ? `Mark set ${index + 1} incomplete` : `Mark set ${index + 1} complete`}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0 font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-90",
          isCompleted
            ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30"
            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
        )}
      >
        <Check className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* Delete Set */}
      <button
        type="button"
        onClick={onDelete}
        title={`Delete set ${index + 1}`}
        aria-label={`Delete set ${index + 1}`}
        className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg transition shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default SetRow;
