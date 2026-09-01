"use client";

import React, { useState } from "react";
import { Trash2, Flame, Info, Plus, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseInstructionsModal } from "@/components/workout/ExerciseInstructionsModal";

export interface RoutineSetItem {
  setNumber: number;
  targetReps: number;
  targetWeight: number | null;
  isWarmup?: boolean;
}

export interface DefaultExerciseItem {
  catalogId: string;
  name: string;
  muscleGroup: string;
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number | null;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  warmupSets?: number;
  warmupReps?: number;
  warmupWeight?: number | null;
  sets: RoutineSetItem[];
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

  // Ensure sets array is properly initialized
  const sets: RoutineSetItem[] =
    exercise.sets && exercise.sets.length > 0
      ? exercise.sets
      : [
          {
            setNumber: 1,
            targetWeight: exercise.targetWeight ?? 50,
            targetReps: exercise.targetReps || 10,
            isWarmup: false,
          },
          {
            setNumber: 2,
            targetWeight: exercise.targetWeight ?? 50,
            targetReps: exercise.targetReps || 10,
            isWarmup: false,
          },
          {
            setNumber: 3,
            targetWeight: exercise.targetWeight ?? 50,
            targetReps: exercise.targetReps || 10,
            isWarmup: false,
          },
        ];

  const hasWarmup = sets.some((s) => s.isWarmup) || !!exercise.isWarmup;

  const updateSets = (newSets: RoutineSetItem[]) => {
    const renumbered = newSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
    const warmups = renumbered.filter((s) => s.isWarmup);
    const working = renumbered.filter((s) => !s.isWarmup);
    const firstWarmup = warmups[0];
    const firstWorking = working[0] || renumbered[0];

    onUpdate({
      sets: renumbered,
      isWarmup: warmups.length > 0,
      warmupSets: warmups.length > 0 ? warmups.length : 1,
      warmupReps: firstWarmup?.targetReps || 12,
      warmupWeight: firstWarmup?.targetWeight ?? null,
      targetSets: working.length,
      targetReps: firstWorking?.targetReps || 10,
      targetWeight: firstWorking?.targetWeight ?? null,
    });
  };

  const handleUpdateSet = (setIndex: number, updated: Partial<RoutineSetItem>) => {
    const next = [...sets];
    next[setIndex] = { ...next[setIndex], ...updated };
    updateSets(next);
  };

  const handleAddWorkingSet = () => {
    const workingSets = sets.filter((s) => !s.isWarmup);
    const lastWorking = workingSets[workingSets.length - 1] || sets[sets.length - 1];
    const newSet: RoutineSetItem = {
      setNumber: sets.length + 1,
      targetWeight: lastWorking?.targetWeight ?? 50,
      targetReps: lastWorking?.targetReps || 10,
      isWarmup: false,
    };
    updateSets([...sets, newSet]);
  };

  const handleAddWarmupSet = () => {
    const warmups = sets.filter((s) => s.isWarmup);
    const firstWorking = sets.find((s) => !s.isWarmup);
    const baseWeight = firstWorking?.targetWeight ?? 50;

    const newWarmup: RoutineSetItem = {
      setNumber: 1,
      targetWeight:
        warmups.length > 0
          ? warmups[warmups.length - 1].targetWeight ?? Math.round(baseWeight * 0.5)
          : Math.round(baseWeight * 0.5) || 20,
      targetReps:
        warmups.length > 0 ? warmups[warmups.length - 1].targetReps || 12 : 12,
      isWarmup: true,
    };

    const lastWarmupIdx = sets.reduce((last, s, idx) => (s.isWarmup ? idx : last), -1);
    const next = [...sets];
    next.splice(lastWarmupIdx + 1, 0, newWarmup);
    updateSets(next);
  };

  const handleDeleteSet = (setIndex: number) => {
    if (sets.length <= 1) {
      updateSets([{ setNumber: 1, targetWeight: 50, targetReps: 10, isWarmup: false }]);
      return;
    }
    const next = sets.filter((_, i) => i !== setIndex);
    updateSets(next);
  };

  const handleDuplicateSet = (setIndex: number) => {
    const target = sets[setIndex];
    const duplicated: RoutineSetItem = {
      setNumber: target.setNumber + 1,
      targetWeight: target.targetWeight,
      targetReps: target.targetReps,
      isWarmup: target.isWarmup,
    };
    const next = [...sets];
    next.splice(setIndex + 1, 0, duplicated);
    updateSets(next);
  };

  const handleToggleWarmup = () => {
    if (hasWarmup) {
      const workingOnly = sets.filter((s) => !s.isWarmup);
      if (workingOnly.length === 0) {
        updateSets([{ setNumber: 1, targetWeight: 50, targetReps: 10, isWarmup: false }]);
      } else {
        updateSets(workingOnly);
      }
    } else {
      handleAddWarmupSet();
    }
  };

  return (
    <>
      <article
        className={cn(
          "p-5 sm:p-6 rounded-[28px] bg-zinc-900/80 backdrop-blur-2xl border shadow-xl space-y-4 transition-all",
          hasWarmup
            ? "border-amber-500/30 bg-linear-to-b from-amber-500/5 to-zinc-900/80 hover:border-amber-500/40"
            : "border-white/10 hover:border-white/20"
        )}
      >
        {/* Exercise Title, Instructions, Warmup Toggle, Unit, Delete */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "w-7 h-7 rounded-xl border flex items-center justify-center font-bold text-xs",
                hasWarmup
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

                {hasWarmup && (
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
            {/* Unit Selector: KG / LBS */}
            <div className="inline-flex rounded-xl bg-zinc-950/80 border border-white/10 p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => onUpdate({ weightUnit: "kg" })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer",
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
                  "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer",
                  currentUnit === "lbs"
                    ? "bg-emerald-500 text-zinc-950 shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
                title="Set unit to Pounds (LBS)"
              >
                LBS
              </button>
            </div>

            {/* Warmup Toggle Button */}
            <button
              type="button"
              onClick={handleToggleWarmup}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border",
                hasWarmup
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                  : "bg-zinc-950/60 text-zinc-400 border-white/8 hover:text-zinc-200 hover:border-white/15"
              )}
              title={hasWarmup ? "Disable Warmup Sets" : "Activate Warmup Sets for this exercise"}
            >
              <Flame
                className={cn(
                  "w-3.5 h-3.5",
                  hasWarmup ? "text-amber-400 fill-amber-400/40" : "text-zinc-500"
                )}
              />
              <span>{hasWarmup ? "Warmup Active" : "Add Warmup"}</span>
            </button>

            {/* Delete Exercise Button */}
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

        {/* Set Rows Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-2 text-[10px] uppercase font-bold text-zinc-500 pt-2 border-t border-white/6">
          <div className="w-10 sm:w-12 text-center shrink-0">Set</div>
          <div className="flex-1 text-center min-w-20">Target Weight</div>
          <div className="flex-1 text-center min-w-20">Target Reps</div>
          <div className="w-16 sm:w-20 text-center shrink-0">Actions</div>
        </div>

        {/* Dynamic Set Rows List */}
        <div className="space-y-2">
          {sets.map((set, setIdx) => {
            const isSetWarmup = !!set.isWarmup;
            const workingIndex = sets.filter((s, i) => !s.isWarmup && i <= setIdx).length;
            const warmupIndex = sets.filter((s, i) => s.isWarmup && i <= setIdx).length;

            return (
              <div
                key={setIdx}
                className={cn(
                  "flex items-center gap-2 sm:gap-3 py-2 px-2.5 rounded-2xl border transition-all",
                  isSetWarmup
                    ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30 text-zinc-300"
                    : "bg-zinc-950/60 border-white/8 hover:border-white/15 text-zinc-300"
                )}
              >
                {/* Set Badge / Indicator */}
                <div className="w-10 sm:w-12 text-center shrink-0 flex items-center justify-center">
                  {isSetWarmup ? (
                    <span
                      className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs flex items-center justify-center shadow-xs"
                      title={`Warmup Set W${warmupIndex}`}
                    >
                      W{warmupIndex > 1 ? warmupIndex : ""}
                    </span>
                  ) : (
                    <span
                      className="w-7 h-7 rounded-xl bg-zinc-800 border border-white/10 text-zinc-200 font-extrabold text-xs flex items-center justify-center"
                      title={`Working Set ${workingIndex}`}
                    >
                      {workingIndex}
                    </span>
                  )}
                </div>

                {/* Target Weight Input */}
                <div className="flex-1 min-w-20">
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={set.targetWeight ?? ""}
                      onChange={(e) =>
                        handleUpdateSet(setIdx, {
                          targetWeight: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      placeholder="0"
                      aria-label={`Set ${setIdx + 1} Target Weight`}
                      className={cn(
                        "w-full text-center py-2 ps-3 pe-9 min-h-9.5 bg-zinc-900 border rounded-xl text-white font-extrabold text-xs sm:text-sm tabular-nums focus:outline-none focus-visible:ring-2",
                        isSetWarmup
                          ? "border-amber-500/30 focus-visible:ring-amber-500/50"
                          : "border-white/10 focus-visible:ring-emerald-500/50"
                      )}
                    />
                    <span
                      className={cn(
                        "absolute inset-e-3 text-[11px] font-black uppercase pointer-events-none",
                        isSetWarmup ? "text-amber-400/80" : "text-emerald-400/80"
                      )}
                    >
                      {currentUnit}
                    </span>
                  </div>
                </div>

                {/* Target Reps Input */}
                <div className="flex-1 min-w-20">
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={set.targetReps ?? 10}
                      onChange={(e) =>
                        handleUpdateSet(setIdx, {
                          targetReps: parseInt(e.target.value, 10) || 10,
                        })
                      }
                      placeholder="10"
                      aria-label={`Set ${setIdx + 1} Target Reps`}
                      className={cn(
                        "w-full text-center py-2 ps-3 pe-11 min-h-9.5 bg-zinc-900 border rounded-xl text-white font-extrabold text-xs sm:text-sm tabular-nums focus:outline-none focus-visible:ring-2",
                        isSetWarmup
                          ? "border-amber-500/30 focus-visible:ring-amber-500/50"
                          : "border-white/10 focus-visible:ring-emerald-500/50"
                      )}
                    />
                    <span className="absolute inset-e-3 text-[11px] font-bold text-zinc-500 pointer-events-none">
                      reps
                    </span>
                  </div>
                </div>

                {/* Row Actions: Duplicate & Delete */}
                <div className="w-16 sm:w-20 shrink-0 flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDuplicateSet(setIdx)}
                    className="p-2 text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"
                    title="Duplicate this set row"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSet(setIdx)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                    title="Delete this set row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons: Add Working Set & Add Warmup Set */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={handleAddWorkingSet}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-bold border border-dashed border-zinc-700/80 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Add Working Set</span>
          </button>

          <button
            type="button"
            onClick={handleAddWarmupSet}
            className="py-2.5 px-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-dashed border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
            title="Add a Warmup Set row for this exercise"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Warmup Set</span>
          </button>
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
