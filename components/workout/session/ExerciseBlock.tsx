"use client";

import React from "react";
import { Check, ChevronRight, Plus, Timer } from "lucide-react";
import { SetLedgerRow } from "@/components/workout/session/SetLedgerRow";
import { fieldHeader, ledgerFields, ledgerGrid, type LedgerField } from "@/components/workout/session/ledger";
import { describeSet, setOrdinals } from "@/lib/workouts/format";
import { formatRestTime } from "@/lib/workouts/calc";
import { previousSetValues, suggestedValues } from "@/lib/workouts/session-state";
import { formatDateString, localDateString } from "@/lib/time";
import type { PreviousPerformanceDTO, SessionExerciseDTO, SessionSetDTO } from "@/lib/workouts/types";
import { cn } from "@/lib/utils";

export interface ExerciseBlockProps {
  exercise: SessionExerciseDTO;
  previous: PreviousPerformanceDTO | undefined;
  expanded: boolean;
  /** The set the dock logs next, when it belongs to this exercise. */
  activeSetId: string | null;
  showPrevious: boolean;
  showTicks: boolean;
  timezone: string;
  restSec: number;
  missing: { setId: string; field: "weight" | "reps" | "duration" } | null;
  onExpand: () => void;
  onUpdateSet: (setId: string, patch: Partial<SessionSetDTO>) => void;
  onToggleSet: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
  onOpenOptions: () => void;
  onOpenDetail: () => void;
  onEnterField: (setId: string, field: LedgerField, fields: LedgerField[]) => void;
  onFocusField: (setId: string, field: LedgerField | null) => void;
}

/**
 * One exercise of the live workout. Expanded: header, column heads, the set
 * rows and "Add set". Collapsed: one line with progress and last time.
 */
export function ExerciseBlock({
  exercise,
  previous,
  expanded,
  activeSetId,
  showPrevious,
  showTicks,
  timezone,
  restSec,
  missing,
  onExpand,
  onUpdateSet,
  onToggleSet,
  onRemoveSet,
  onAddSet,
  onOpenOptions,
  onOpenDetail,
  onEnterField,
  onFocusField,
}: ExerciseBlockProps) {
  const done = exercise.sets.filter((set) => set.done).length;
  const total = exercise.sets.length;
  const finished = total > 0 && done === total;
  const workingLast = previous?.sets.filter((set) => set.type !== "warmup") ?? [];
  const lastSummary = workingLast.length > 0 ? describeSet(workingLast[0], exercise.unit) : null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center justify-between gap-2.5 border-b border-line px-3 py-3 text-start transition-colors hover:bg-surface/60 cursor-pointer"
      >
        <span className="min-w-0">
          <span className={cn("block truncate text-section font-semibold", finished ? "text-ink-2" : "text-ink")}>
            {exercise.name}
          </span>
          <span className="mt-0.5 block text-xs text-ink-3">
            <span className="font-mono tabular-nums">
              {done} / {total}
            </span>{" "}
            sets
            {!finished && showPrevious && lastSummary && (
              <>
                {" "}
                · Last <span className="font-mono tabular-nums">{lastSummary}</span>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {finished && (
            <span className="grid h-6 w-6 place-items-center rounded-chip border border-line bg-elevated text-ink" aria-label="Exercise complete">
              <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
        </span>
      </button>
    );
  }

  const hasAddedWeight = exercise.sets.some((set) => set.weightKg != null && set.weightKg > 0);
  const fields = ledgerFields(exercise.trackingType, hasAddedWeight);
  const ordinals = setOrdinals(exercise.sets);
  const lastDate = previous
    ? formatDateString(localDateString(new Date(previous.performedAt), timezone), { month: "short", day: "numeric" })
    : null;
  const lastLine = previous
    ? workingLast
        .slice(0, 4)
        .map((set) => describeSet(set, exercise.unit).replace(" × ", "×"))
        .join(", ")
    : null;

  return (
    <section aria-label={exercise.name} className="border-b border-line">
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2.5">
        <button type="button" onClick={onOpenDetail} className="min-w-0 text-start cursor-pointer">
          <h2 className="truncate text-[17px] font-semibold leading-6 tracking-[-0.015em] text-ink">{exercise.name}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {!showPrevious ? (
              exercise.primaryMuscle
            ) : previous ? (
              <>
                Last {lastDate} · <span className="font-mono tabular-nums">{lastLine}</span>
              </>
            ) : (
              "First time: no earlier result"
            )}
          </p>
          {exercise.notes && <p className="mt-1 text-xs text-ink-2">{exercise.notes}</p>}
        </button>
        <button
          type="button"
          onClick={onOpenOptions}
          aria-label={`Options for ${exercise.name} (rest ${formatRestTime(restSec)})`}
          className="relative inline-flex h-7 shrink-0 items-center gap-[5px] rounded-chip border border-line bg-surface px-[9px] font-mono text-xs text-ink-2 transition-colors hover:border-line-strong cursor-pointer before:absolute before:-inset-2 before:content-['']"
        >
          <Timer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {restSec > 0 ? `${Math.floor(restSec / 60)}:${String(restSec % 60).padStart(2, "0")}` : "Off"}
        </button>
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "grid h-[26px] items-center gap-2 border-y border-line bg-recessed px-3 text-center text-xs font-medium text-ink-3",
          ledgerGrid(fields)
        )}
      >
        <span>Set</span>
        <span>Prev</span>
        {fields.map((field) => (
          <span key={field}>{fieldHeader(field, exercise.unit, exercise.trackingType)}</span>
        ))}
        <span>{showTicks ? "Done" : ""}</span>
      </div>

      {exercise.sets.map((set, index) => (
        <SetLedgerRow
          key={set.id}
          set={set}
          ordinal={ordinals[index]}
          exerciseName={exercise.name}
          trackingType={exercise.trackingType}
          unit={exercise.unit}
          fields={fields}
          previous={showPrevious ? previousSetValues(exercise, index, previous) : null}
          suggestion={suggestedValues(exercise, index, previous)}
          isActive={set.id === activeSetId}
          missing={missing?.setId === set.id ? missing.field : null}
          showTick={showTicks}
          onChange={(patch) => onUpdateSet(set.id, patch)}
          onToggle={() => onToggleSet(set.id)}
          onRemove={() => onRemoveSet(set.id)}
          onEnterField={(field) => onEnterField(set.id, field, fields)}
          onFocusField={(field) => onFocusField(set.id, field)}
        />
      ))}

      <button
        type="button"
        onClick={onAddSet}
        className="flex h-10 w-full items-center justify-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface/60 hover:text-ink cursor-pointer"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add set
      </button>
    </section>
  );
}

export default ExerciseBlock;
