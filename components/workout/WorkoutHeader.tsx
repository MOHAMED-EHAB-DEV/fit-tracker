"use client";

import React, { useState } from "react";
import { Check, Loader2, Calendar, Dumbbell, Trash2 } from "lucide-react";
import { DayOfWeek } from "@/lib/db/models/Workout";
import { Modal } from "@/components/ui/Modal";
import { DAYS_OF_WEEK } from "@/constants/workout";

interface WorkoutHeaderProps {
  name: string;
  dayOfWeek?: DayOfWeek | string;
  isSaving: boolean;
  onNameChange: (newName: string) => void;
  onDayOfWeekChange?: (newDay: DayOfWeek) => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  onFinish: () => void;
}

export function WorkoutHeader({
  name,
  dayOfWeek = "saturday",
  isSaving,
  onNameChange,
  onDayOfWeekChange,
  onDelete,
  isDeleting = false,
  onFinish,
}: WorkoutHeaderProps) {
  const currentDayKey = (dayOfWeek?.toLowerCase() || "saturday") as DayOfWeek;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    if (onDelete) onDelete();
  };

  return (
    <>
      <div className="p-5 md:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Workout Name & Weekday Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Dumbbell className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Weekly Routine Log
              </span>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Name your workout log..."
              className="w-full text-xl md:text-2xl font-extrabold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 pb-1 focus:outline-none transition placeholder-zinc-600"
            />

            <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap pt-1">
              {/* Day of Week Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-950/80 px-2.5 py-1.5 rounded-xl border border-zinc-800 text-zinc-200">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-400">Day:</span>
                <select
                  value={currentDayKey}
                  onChange={(e) => onDayOfWeekChange && onDayOfWeekChange(e.target.value as DayOfWeek)}
                  className="bg-transparent text-xs font-bold text-emerald-300 focus:outline-none cursor-pointer capitalize"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.key} value={d.key} className="bg-zinc-900 text-white">
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <span>•</span>

              <div className="flex items-center gap-1">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                    <span className="text-zinc-500">Auto-saving...</span>
                  </>
                ) : (
                  <span className="text-emerald-400 font-semibold">Saved ✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Delete + Save */}
          <div className="flex items-center gap-2 shrink-0">
            {onDelete && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(true)}
                className="p-3 rounded-2xl bg-zinc-950/80 hover:bg-red-500/15 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition"
                title="Delete this workout log"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onFinish}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Save Workout Log</span>
            </button>
          </div>
        </div>

        {/* Quick Weekday Switcher Strip */}
        <div className="flex items-center gap-1 sm:gap-1.5 pt-2 border-t border-zinc-800/60 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 me-1 shrink-0">Assigned Day:</span>
          {DAYS_OF_WEEK.map((d) => {
            const isSelected = currentDayKey === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onDayOfWeekChange && onDayOfWeekChange(d.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                  isSelected
                    ? "bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20"
                    : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteConfirm(false)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>Delete Workout Log</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300">
              Are you sure you want to permanently delete <strong className="text-white">&quot;{name || "this workout"}&quot;</strong>? This action cannot be undone and will reset this day to a blank target sheet.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95"
              >
                Delete Workout
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default WorkoutHeader;
