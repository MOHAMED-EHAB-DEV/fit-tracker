"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers, Play, Trash2, Calendar, Loader2, Save } from "lucide-react";
import { DayOfWeek } from "@/lib/db/models/Workout";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK } from "@/constants/workout";

interface RoutineBuilderHeaderProps {
  workoutId: string;
  name: string;
  dayOfWeek: DayOfWeek;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  exercisesCount: number;
  totalPlannedSets: number;
  plannedCalories: number;
  onNameChange: (name: string) => void;
  onDayOfWeekChange: (day: DayOfWeek) => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function RoutineBuilderHeader({
  workoutId,
  name,
  dayOfWeek,
  isSaving,
  hasUnsavedChanges,
  exercisesCount,
  totalPlannedSets,
  plannedCalories,
  onNameChange,
  onDayOfWeekChange,
  onSave,
  onDelete,
}: RoutineBuilderHeaderProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <header className="p-6 md:p-8 rounded-[28px] bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Workout Routine Builder
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  hasUnsavedChanges
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                )}
              >
                {isSaving ? "Saving..." : hasUnsavedChanges ? "Unsaved Changes" : "Saved ✓"}
              </span>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Push Day (Chest & Triceps)"
              className="w-full text-xl sm:text-2xl font-extrabold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 pb-1 focus:outline-none transition placeholder-zinc-600"
            />
          </div>

          {/* Action CTAs: Save Routine, Delete, Start Gym Session */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Manual Save Routine Button */}
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md",
                hasUnsavedChanges
                  ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/25"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{hasUnsavedChanges ? "Save Routine" : "Saved"}</span>
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="p-2.5 rounded-2xl bg-zinc-950/60 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition cursor-pointer"
              title="Delete routine"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Start Gym Session */}
            <Link
              href={`/workouts/${workoutId}/active`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-zinc-950" />
              <span>Start Gym Workout</span>
            </Link>
          </div>
        </div>

        {/* Assigned Day of Week Selector */}
        <div className="pt-3 border-t border-white/6 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Assigned Day of the Week:</span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = dayOfWeek === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDayOfWeekChange(d.key)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition text-center border cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 text-zinc-950 border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-zinc-950/60 border-white/8 text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Routine Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-white/6 text-xs text-zinc-400 flex-wrap gap-2">
          <span>Planned Exercises: <strong className="text-white">{exercisesCount}</strong></span>
          <span>
            Total Planned Sets: <strong className="text-emerald-400">{totalPlannedSets} sets</strong>
          </span>
          <span>
            Total Routine Burn: <strong className="text-orange-400">{plannedCalories} kcal</strong>
          </span>
          <span className="hidden sm:inline text-zinc-500">
            Weight Units: <strong className="text-zinc-300">Custom per Exercise</strong>
          </span>
        </div>
      </header>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteModal(false)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>Delete Routine Template</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300">
              Are you sure you want to delete this workout routine template? This will remove the default exercise plan for {dayOfWeek}.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Routine</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default RoutineBuilderHeader;
