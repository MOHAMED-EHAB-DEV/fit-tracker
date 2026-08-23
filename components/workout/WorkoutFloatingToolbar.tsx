"use client";

import React, { useState } from "react";
import { Save, Check, Loader2, RotateCcw, AlertTriangle, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface WorkoutFloatingToolbarProps {
  isVisible: boolean;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  statusText?: string;
  saveLabel?: string;
  discardLabel?: string;
  discardTitle?: string;
  discardDescription?: string;
  addExerciseLabel?: string;
  onAddExercise?: () => void;
  onSave: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
}

export function WorkoutFloatingToolbar({
  isVisible,
  isSaving = false,
  hasUnsavedChanges = false,
  statusText,
  saveLabel = "Save",
  discardLabel = "Discard",
  discardTitle = "Discard Changes?",
  discardDescription = "Are you sure you want to discard your changes? Any unsaved modifications to your workout will be lost.",
  addExerciseLabel = "Add Exercise",
  onAddExercise,
  onSave,
  onDiscard,
}: WorkoutFloatingToolbarProps) {
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const handleConfirmDiscard = async () => {
    setIsDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setIsDiscarding(false);
      setShowDiscardModal(false);
    }
  };

  return (
    <>
      <aside
        aria-label="Workout quick actions"
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out flex items-center",
          isVisible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-8 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-zinc-950/90 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/80 ring-1 ring-white/10">
          {/* Status Indicator Dot */}
          <div className="hidden md:flex items-center gap-2 pl-1 pr-2 border-r border-white/10 text-xs">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                hasUnsavedChanges
                  ? "bg-amber-400 animate-pulse"
                  : "bg-emerald-400"
              )}
            />
            <span className="font-semibold text-zinc-300 text-[11px] whitespace-nowrap">
              {statusText || (hasUnsavedChanges ? "Unsaved Changes" : "Up to Date")}
            </span>
          </div>

          {/* Add Exercise Button */}
          {onAddExercise && (
            <button
              type="button"
              onClick={onAddExercise}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900/90 hover:bg-emerald-500/15 text-zinc-300 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
              title="Add a new exercise from catalog"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{addExerciseLabel}</span>
            </button>
          )}

          {/* Discard Button (Triggers Confirm Modal) */}
          <button
            type="button"
            onClick={() => setShowDiscardModal(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900/90 hover:bg-red-500/15 text-zinc-300 hover:text-red-300 border border-white/10 hover:border-red-500/30 font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
            title="Discard current changes"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{discardLabel}</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
            ) : saveLabel.toLowerCase().includes("finish") ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : saveLabel}</span>
          </button>
        </div>
      </aside>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDiscardModal(false)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">{discardTitle}</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-300">{discardDescription}</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                disabled={isDiscarding}
                onClick={handleConfirmDiscard}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {isDiscarding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Discard Changes</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default WorkoutFloatingToolbar;
