"use client";

import React from "react";
import { Check, Trophy } from "lucide-react";
import { LedgerInput } from "@/components/workout/session/LedgerInput";
import { SetBadge } from "@/components/workout/session/SetBadge";
import {
  fieldDecimals,
  fieldMax,
  fieldValue,
  formatPrev,
  ledgerGrid,
  type LedgerField,
} from "@/components/workout/session/ledger";
import { toKg, type WeightUnit } from "@/lib/fitness/units";
import { SET_TYPE_LABELS, type TrackingType } from "@/lib/workouts/taxonomy";
import type { SetValues } from "@/lib/workouts/session-state";
import type { SessionSetDTO } from "@/lib/workouts/types";
import { cn } from "@/lib/utils";

export interface SetLedgerRowProps {
  set: SessionSetDTO;
  /** Position among sets of the same kind ("3" for the third working set). */
  ordinal: number;
  exerciseName: string;
  trackingType: TrackingType;
  unit: WeightUnit;
  fields: LedgerField[];
  /** Last time's matching set (Prev column). */
  previous: SetValues | null;
  /** Logged when the tick is pressed with empty boxes. */
  suggestion: SetValues;
  /** The set the dock will log next: the only accented row. */
  isActive: boolean;
  /** Briefly highlights a box that still needs a value. */
  missing: "weight" | "reps" | "duration" | null;
  /** When the workout is being typed in afterwards there is no tick to press. */
  showTick: boolean;
  onChange: (patch: Partial<SessionSetDTO>) => void;
  onToggle: () => void;
  onRemove: () => void;
  onEnterField: (field: LedgerField) => void;
  onFocusField: (field: LedgerField | null) => void;
}

/** A set's value as a patch for its own unit and type. */
export function patchFor(
  field: LedgerField,
  value: number | null,
  unit: WeightUnit,
  trackingType: TrackingType
): Partial<SessionSetDTO> {
  switch (field) {
    case "weight":
      return { weightKg: value == null ? null : toKg(value, unit) };
    case "reps":
      return { reps: value };
    case "duration":
      return { durationSec: value == null ? null : trackingType === "cardio" ? Math.round(value * 60) : value };
    case "distance":
      return { distanceM: value == null ? null : Math.round(value * 1000) };
  }
}

function fieldLabel(field: LedgerField, unit: WeightUnit, trackingType: TrackingType): string {
  switch (field) {
    case "weight":
      return trackingType === "bodyweight_reps" ? `added weight in ${unit}` : `weight in ${unit}`;
    case "reps":
      return "reps";
    case "duration":
      return trackingType === "cardio" ? "time in minutes" : "time in seconds";
    case "distance":
      return "distance in kilometres";
  }
}

/**
 * One row of the set ledger: the set badge (opens type, effort and delete),
 * last time's numbers, the value boxes and the tick. Done rows go quiet; the
 * active row is the only accented one.
 */
export function SetLedgerRow({
  set,
  ordinal,
  exerciseName,
  trackingType,
  unit,
  fields,
  previous,
  suggestion,
  isActive,
  missing,
  showTick,
  onChange,
  onToggle,
  onRemove,
  onEnterField,
  onFocusField,
}: SetLedgerRowProps) {
  const typeLabel = SET_TYPE_LABELS[set.type];
  const setName = set.type === "working" ? `Set ${ordinal}` : `${typeLabel.label} ${ordinal}`;
  const tone = set.done ? "done" : isActive ? "active" : "open";
  const hasMeta = set.prKinds.length > 0 || set.rpe != null;

  return (
    <div
      className={cn(
        "grid min-h-[52px] items-center gap-2 border-b border-line px-3 py-1",
        ledgerGrid(fields),
        set.done ? "bg-canvas" : isActive ? "bg-surface shadow-[inset_3px_0_0_var(--accent)]" : "bg-transparent"
      )}
    >
      <SetBadge
        setName={setName}
        exerciseName={exerciseName}
        type={set.type}
        ordinal={ordinal}
        rpe={set.rpe}
        highlighted={isActive && !set.done}
        addedWeight={trackingType === "bodyweight_reps" ? { valueKg: set.weightKg, unit } : null}
        onChange={onChange}
        onRemove={onRemove}
      />

      <span className="truncate text-center font-mono text-xs tabular-nums text-ink-3" aria-label={`Last time ${formatPrev(previous, unit, trackingType)}`}>
        {formatPrev(previous, unit, trackingType)}
      </span>

      {fields.map((field) => (
        <LedgerInput
          key={field}
          id={`set-${set.id}-${field}`}
          label={`${setName} ${fieldLabel(field, unit, trackingType)}`}
          value={fieldValue(set, field, unit, trackingType)}
          ghost={set.done ? null : fieldValue(suggestion, field, unit, trackingType)}
          decimals={fieldDecimals(field, trackingType)}
          max={fieldMax(field, unit, trackingType)}
          tone={tone}
          highlight={
            (missing === "weight" && field === "weight") ||
            (missing === "reps" && field === "reps") ||
            (missing === "duration" && field === "duration")
          }
          onChange={(value) => onChange(patchFor(field, value, unit, trackingType))}
          onEnter={() => onEnterField(field)}
          onFocusChange={(focused) => onFocusField(focused ? field : null)}
        />
      ))}

      {showTick ? (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={set.done}
          aria-label={set.done ? `${setName} logged. Tap to undo` : `Log ${setName}`}
          className={cn(
            "grid h-11 w-[52px] place-items-center rounded-control border transition-colors active:scale-95 cursor-pointer",
            set.done
              ? "border-line bg-elevated text-ink"
              : isActive
                ? "border-ink bg-ink text-ink-inverse"
                : "border-line bg-transparent text-ink-3 hover:text-ink"
          )}
        >
          <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      ) : (
        <span aria-hidden="true" />
      )}

      {hasMeta && (
        <p className="col-[2/-2] -mt-0.5 flex gap-2.5 pb-1 text-xs">
          {set.prKinds.length > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-warn">
              <Trophy className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              New PR
            </span>
          )}
          {set.rpe != null && <span className="font-mono tabular-nums text-ink-3">RPE {set.rpe}</span>}
        </p>
      )}
    </div>
  );
}

export default SetLedgerRow;
