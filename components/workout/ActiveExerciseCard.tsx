"use client";

import React, { useState } from "react";
import { Plus, Trash2, Flame, Info } from "lucide-react";
import { SetRow, SetData } from "@/components/workout/SetRow";
import { ExerciseInstructionsModal } from "@/components/workout/ExerciseInstructionsModal";
import { cn } from "@/lib/utils";

export interface ActiveExerciseItem {
  catalogId: string;
  name: string;
  muscleGroup: string;
  metValue?: number;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  sets: SetData[];
  notes?: string | null;
  oneRM?: number | null;
}

interface ActiveExerciseCardProps {
  exercise: ActiveExerciseItem;
  index: number;
  weightUnit?: "kg" | "lbs";
  onUpdateSet: (setIndex: number, updated: Partial<SetData>) => void;
  onAddSet: () => void;
  onAddWarmupSet?: () => void;
  onDeleteSet: (setIndex: number) => void;
  onDeleteExercise: () => void;
  onToggleUnit?: () => void;
  onToggleWarmup?: () => void;
}

export function ActiveExerciseCard({
  exercise,
  index,
  weightUnit = "kg",
  onUpdateSet,
  onAddSet,
  onAddWarmupSet,
  onDeleteSet,
  onDeleteExercise,
  onToggleUnit,
  onToggleWarmup,
}: ActiveExerciseCardProps) {
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const currentUnit = exercise.weightUnit || weightUnit || "kg";
  const isWarmup = !!exercise.isWarmup || exercise.sets.some((s) => s.isWarmup);

  return (
    <>
      <article
        className={cn(
          "p-5 sm:p-6 rounded-[28px] bg-zinc-900/85 backdrop-blur-2xl border shadow-xl space-y-4 transition-all",
          isWarmup
            ? "border-amber-500/30 bg-linear-to-b from-amber-500/5 to-zinc-900/85"
            : "border-white/10"
        )}
      >
        {/* Exercise Title, Instructions Button, Warmup Toggle, and Remove */}
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
          {onToggleWarmup && (
            <button
              type="button"
              onClick={onToggleWarmup}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border",
                isWarmup
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-zinc-950/60 text-zinc-400 border-white/8 hover:text-zinc-200"
              )}
              title={isWarmup ? "Warmup active for this exercise" : "Click to activate Warmup Sets"}
            >
              <Flame
                className={cn(
                  "w-3.5 h-3.5",
                  isWarmup ? "text-amber-400 fill-amber-400/40" : "text-zinc-500"
                )}
              />
              <span>{isWarmup ? "Warmup Active" : "Add Warmup"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDeleteExercise}
            className="p-1.5 text-zinc-500 hover:text-red-400 transition cursor-pointer"
            title="Remove exercise from session"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center gap-1.5 sm:gap-3 px-2.5 text-[10px] uppercase font-bold text-zinc-500">
        <div className="w-5 sm:w-7 text-center shrink-0">Set</div>
        <div className="hidden sm:block w-20 sm:w-24 text-center shrink-0">Target</div>
        <div className="flex-1 text-center min-w-14 sm:min-w-17.5">
          {onToggleUnit ? (
            <button
              type="button"
              onClick={onToggleUnit}
              className="text-emerald-400 font-extrabold hover:text-emerald-300 transition cursor-pointer"
              title="Click to switch unit (KG / LBS)"
            >
              {currentUnit} ⇄
            </button>
          ) : (
            <span className="text-emerald-400 font-extrabold">{currentUnit}</span>
          )}
        </div>
        <div className="flex-1 text-center min-w-12 sm:min-w-15">Reps</div>
        <div className="w-12 sm:w-14 text-center shrink-0 hidden md:block">RPE</div>
        <div className="w-7 sm:w-8 text-center shrink-0">✓</div>
        <div className="w-6"></div>
      </div>

      {/* Set Rows for Recording */}
      <div className="space-y-2">
        {exercise.sets.map((set, setIdx) => (
          <SetRow
            key={setIdx}
            set={set}
            index={setIdx}
            unit={currentUnit}
            onChange={(data) => onUpdateSet(setIdx, data)}
            onDelete={() => onDeleteSet(setIdx)}
            onComplete={() => {}}
          />
        ))}
      </div>

      {/* Action Buttons: Add Working Set & Add Warmup Set */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="flex-1 py-2.5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold border border-dashed border-zinc-700/80 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Working Set</span>
        </button>

        {onAddWarmupSet && (
          <button
            type="button"
            onClick={onAddWarmupSet}
            className="py-2.5 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-dashed border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="Add a Warmup Set for this exercise"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Warmup Set</span>
          </button>
        )}
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

export default ActiveExerciseCard;
