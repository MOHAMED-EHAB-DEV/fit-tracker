"use client";

import React from "react";
import { LedgerInput } from "@/components/workout/session/LedgerInput";
import { SetBadge } from "@/components/workout/session/SetBadge";
import { fromKg, toKg, type WeightUnit } from "@/lib/fitness/units";
import { SET_TYPE_LABELS, type TrackingType } from "@/lib/workouts/taxonomy";
import type { RoutineSetDTO } from "@/lib/workouts/types";
import { cn } from "@/lib/utils";

/** The value columns of a routine (target) ledger. */
export type TargetColumn = "weight" | "reps" | "duration";

export function targetColumns(trackingType: TrackingType, hasAddedWeight: boolean): TargetColumn[] {
  switch (trackingType) {
    case "weight_reps":
      return ["weight", "reps"];
    case "bodyweight_reps":
      return hasAddedWeight ? ["weight", "reps"] : ["reps"];
    default:
      return ["duration"];
  }
}

/** Static grid templates (so Tailwind generates them): Set · values. */
export function targetGrid(columns: TargetColumn[]): string {
  return columns.length === 2 ? "grid-cols-[36px_minmax(0,1fr)_minmax(0,1.5fr)]" : "grid-cols-[36px_minmax(0,1fr)]";
}

export function targetHeader(column: TargetColumn, unit: WeightUnit, trackingType: TrackingType): string {
  switch (column) {
    case "weight":
      return trackingType === "bodyweight_reps" ? `Added ${unit}` : `Target ${unit}`;
    case "reps":
      return "Reps (from – to)";
    case "duration":
      return trackingType === "cardio" ? "Time (min)" : "Time (sec)";
  }
}

/** Moves focus to the next target box of the editor, or closes the keyboard after the last. */
export function focusNextTarget(currentId: string): void {
  const boxes = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-target-box]"));
  const index = boxes.findIndex((box) => box.id === currentId);
  const next = index >= 0 ? boxes[index + 1] : undefined;
  if (next) next.focus();
  else (document.activeElement as HTMLElement | null)?.blur();
}

export interface RoutineSetRowProps {
  /** Stable key of the set inside the editor. */
  setKey: string;
  set: RoutineSetDTO;
  ordinal: number;
  exerciseName: string;
  trackingType: TrackingType;
  unit: WeightUnit;
  columns: TargetColumn[];
  onChange: (patch: Partial<RoutineSetDTO>) => void;
  onRemove: () => void;
}

/**
 * One planned set in the routine editor: the same badge and popover as the
 * live workout (type, target effort, added weight, delete) and the target
 * boxes (weight, a rep range, or a time).
 */
export function RoutineSetRow({ setKey, set, ordinal, exerciseName, trackingType, unit, columns, onChange, onRemove }: RoutineSetRowProps) {
  const typeLabel = SET_TYPE_LABELS[set.type];
  const setName = set.type === "working" ? `Set ${ordinal}` : `${typeLabel.label} ${ordinal}`;
  const isCardio = trackingType === "cardio";

  const box = (
    field: "weight" | "repMin" | "repMax" | "duration",
    label: string,
    value: number | null,
    decimals: number,
    max: number,
    onValue: (value: number | null) => void
  ) => {
    const id = `rt-${setKey}-${field}`;
    return (
      <LedgerInput
        id={id}
        label={`${setName} ${label}`}
        value={value}
        onChange={onValue}
        decimals={decimals}
        max={max}
        tone="open"
        onEnter={() => focusNextTarget(id)}
        onFocusChange={() => undefined}
        dataTargetBox
      />
    );
  };

  return (
    <div className={cn("grid min-h-[52px] items-center gap-2 border-b border-line px-3 py-1 last:border-b-0", targetGrid(columns))}>
      <SetBadge
        setName={setName}
        exerciseName={exerciseName}
        type={set.type}
        ordinal={ordinal}
        rpe={set.targetRpe}
        rpeLabel="Target effort (RPE, optional)"
        addedWeight={trackingType === "bodyweight_reps" ? { valueKg: set.targetWeightKg, unit } : null}
        onChange={(patch) =>
          onChange({
            ...(patch.type ? { type: patch.type } : {}),
            ...(patch.rpe !== undefined ? { targetRpe: patch.rpe } : {}),
            ...(patch.weightKg !== undefined ? { targetWeightKg: patch.weightKg } : {}),
          })
        }
        onRemove={onRemove}
      />

      {columns.map((column) => {
        if (column === "weight") {
          return (
            <React.Fragment key={column}>
              {box(
                "weight",
                trackingType === "bodyweight_reps" ? `added weight in ${unit}` : `target weight in ${unit}`,
                set.targetWeightKg == null ? null : fromKg(set.targetWeightKg, unit, 2),
                2,
                unit === "lbs" ? 4400 : 2000,
                (value) => onChange({ targetWeightKg: value == null ? null : toKg(value, unit) })
              )}
            </React.Fragment>
          );
        }
        if (column === "reps") {
          return (
            <div key={column} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
              {box("repMin", "reps from", set.repMin, 0, 1000, (value) => onChange({ repMin: value }))}
              <span aria-hidden="true" className="font-mono text-sm text-ink-3">
                –
              </span>
              {box("repMax", "reps to", set.repMax, 0, 1000, (value) => onChange({ repMax: value }))}
            </div>
          );
        }
        return (
          <React.Fragment key={column}>
            {box(
              "duration",
              isCardio ? "target time in minutes" : "target time in seconds",
              set.targetDurationSec == null
                ? null
                : isCardio
                  ? Math.round((set.targetDurationSec / 60) * 10) / 10
                  : set.targetDurationSec,
              isCardio ? 1 : 0,
              isCardio ? 1440 : 86_400,
              (value) =>
                onChange({ targetDurationSec: value == null ? null : isCardio ? Math.round(value * 60) : value })
            )}
          </React.Fragment>
        );
      })}

      {set.targetRpe != null && (
        <p className="col-[2/-1] -mt-0.5 pb-1 font-mono text-xs tabular-nums text-ink-3">Target RPE {set.targetRpe}</p>
      )}
    </div>
  );
}

export default RoutineSetRow;
