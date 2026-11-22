"use client";

import React from "react";
import { Plus, Timer } from "lucide-react";
import { RoutineSetRow, targetColumns, targetGrid, targetHeader } from "@/components/workout/routine/RoutineSetRow";
import { setOrdinals } from "@/lib/workouts/format";
import { cn } from "@/lib/utils";
import type { RoutineExerciseDTO, RoutineSetDTO } from "@/lib/workouts/types";

export type EditorSet = RoutineSetDTO & { key: string };
export type EditorExercise = Omit<RoutineExerciseDTO, "sets"> & { sets: EditorSet[] };

export interface RoutineExerciseBlockProps {
  exercise: EditorExercise;
  position: number;
  restSec: number;
  onOpenDetail: () => void;
  onOpenOptions: () => void;
  onUpdateSet: (key: string, patch: Partial<RoutineSetDTO>) => void;
  onRemoveSet: (key: string) => void;
  onAddSet: () => void;
}

/** One exercise of a routine: header (details, rest and options), the target ledger, Add set. */
export function RoutineExerciseBlock({
  exercise,
  position,
  restSec,
  onOpenDetail,
  onOpenOptions,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
}: RoutineExerciseBlockProps) {
  const hasAddedWeight = exercise.sets.some((set) => set.targetWeightKg != null && set.targetWeightKg > 0);
  const columns = targetColumns(exercise.trackingType, hasAddedWeight);
  const ordinals = setOrdinals(exercise.sets);

  return (
    <section aria-label={exercise.name} className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2.5">
        <button type="button" onClick={onOpenDetail} aria-haspopup="dialog" className="min-w-0 text-start cursor-pointer">
          <h2 className="truncate text-[17px] font-semibold leading-6 tracking-[-0.015em] text-ink">
            <span className="font-mono text-ink-3 tabular-nums">{position}. </span>
            {exercise.name}
          </h2>
          <p className="mt-0.5 truncate text-xs capitalize text-ink-3">{exercise.primaryMuscle}</p>
          {exercise.notes && <p className="mt-1 text-xs text-ink-2">{exercise.notes}</p>}
        </button>
        <button
          type="button"
          onClick={onOpenOptions}
          aria-haspopup="dialog"
          aria-label={`Options for ${exercise.name} (rest ${restSec > 0 ? `${Math.floor(restSec / 60)}:${String(restSec % 60).padStart(2, "0")}` : "off"})`}
          className="relative inline-flex h-7 shrink-0 items-center gap-[5px] rounded-chip border border-line bg-surface px-[9px] font-mono text-xs text-ink-2 transition-colors hover:border-line-strong cursor-pointer before:absolute before:-inset-2 before:content-['']"
        >
          <Timer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {restSec > 0 ? `${Math.floor(restSec / 60)}:${String(restSec % 60).padStart(2, "0")}` : "Off"}
        </button>
      </div>

      {exercise.sets.length > 0 && (
        <div
          aria-hidden="true"
          className={cn(
            "grid h-[26px] items-center gap-2 border-y border-line bg-recessed px-3 text-center text-xs font-medium text-ink-3",
            targetGrid(columns)
          )}
        >
          <span>Set</span>
          {columns.map((column) => (
            <span key={column} className="truncate">
              {targetHeader(column, exercise.unit, exercise.trackingType)}
            </span>
          ))}
        </div>
      )}

      {exercise.sets.map((set, index) => (
        <RoutineSetRow
          key={set.key}
          setKey={set.key}
          set={set}
          ordinal={ordinals[index]}
          exerciseName={exercise.name}
          trackingType={exercise.trackingType}
          unit={exercise.unit}
          columns={columns}
          onChange={(patch) => onUpdateSet(set.key, patch)}
          onRemove={() => onRemoveSet(set.key)}
        />
      ))}

      <button
        type="button"
        onClick={onAddSet}
        className="flex h-10 w-full items-center justify-center gap-1.5 border-t border-line text-[13px] font-medium text-ink-2 transition-colors hover:bg-elevated/60 hover:text-ink cursor-pointer"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add set
      </button>
    </section>
  );
}

export default RoutineExerciseBlock;
