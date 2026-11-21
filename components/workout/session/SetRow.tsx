"use client";

import React from "react";
import { Check, Trophy } from "lucide-react";
import { NumberField } from "@/components/ui/NumberField";
import { cn } from "@/lib/utils";
import { fromKg, toKg, type WeightUnit } from "@/lib/fitness/units";
import { SET_TYPE_LABELS, type TrackingType } from "@/lib/workouts/taxonomy";
import type { SetValues } from "@/lib/workouts/session-state";
import type { SessionSetDTO } from "@/lib/workouts/types";

interface SetRowProps {
  set: SessionSetDTO;
  /** Position among sets of the same kind, starting at 1 ("3" for the third working set). */
  ordinal: number;
  exerciseName: string;
  trackingType: TrackingType;
  unit: WeightUnit;
  /** Values logged if the set is ticked while its boxes are empty. */
  suggestion: SetValues;
  /** Briefly highlights the box that still needs a value. */
  missing: "weight" | "reps" | "duration" | null;
  onChange: (patch: Partial<SessionSetDTO>) => void;
  onToggle: () => void;
  onOpenOptions: () => void;
}

const hint = (value: number | null, digits = 1): string | undefined =>
  value == null ? undefined : String(Math.round(value * 10 ** digits) / 10 ** digits);

/**
 * One set: a type badge (opens the set options), the values for this
 * exercise type, and a large tick. Greyed numbers are what will be logged if
 * the tick is pressed without typing.
 */
export function SetRow({
  set,
  ordinal,
  exerciseName,
  trackingType,
  unit,
  suggestion,
  missing,
  onChange,
  onToggle,
  onOpenOptions,
}: SetRowProps) {
  const typeLabel = SET_TYPE_LABELS[set.type];
  const badgeText = set.type === "working" ? String(ordinal) : typeLabel.short;
  const setName = `${typeLabel.label} ${ordinal}`;
  const ring = (field: "weight" | "reps" | "duration") =>
    missing === field ? "ring-1 ring-amber-400 rounded-xl" : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl px-1.5 py-1.5",
        set.done ? "bg-emerald-500/10" : "bg-transparent"
      )}
    >
      <button
        type="button"
        onClick={onOpenOptions}
        aria-label={`${setName} of ${exerciseName}: options`}
        className={cn(
          "relative grid place-items-center w-11 h-12 rounded-xl text-sm font-bold shrink-0 cursor-pointer",
          set.type === "warmup"
            ? "bg-amber-500/15 text-amber-300"
            : set.type === "working"
              ? "bg-surface-2 text-zinc-200"
              : "bg-sky-500/15 text-sky-300"
        )}
      >
        {badgeText}
        {set.prKinds.length > 0 && (
          <Trophy className="absolute -top-1 -end-1 w-4 h-4 text-amber-400" aria-label="Personal record" />
        )}
      </button>

      {(trackingType === "weight_reps" || trackingType === "bodyweight_reps") && (
        <>
          <NumberField
            className={cn("flex-1 min-w-0", ring("weight"))}
            label={`${setName} weight in ${unit}`}
            value={set.weightKg == null ? null : fromKg(set.weightKg, unit, 2)}
            onChange={(value) => onChange({ weightKg: value == null ? null : toKg(value, unit) })}
            decimals={2}
            max={unit === "lbs" ? 4400 : 2000}
            suffix={unit}
            placeholder={
              trackingType === "bodyweight_reps"
                ? "+0"
                : hint(suggestion.weightKg == null ? null : fromKg(suggestion.weightKg, unit, 2))
            }
          />
          <NumberField
            className={cn("flex-1 min-w-0", ring("reps"))}
            label={`${setName} reps`}
            value={set.reps}
            onChange={(value) => onChange({ reps: value })}
            max={1000}
            suffix="reps"
            placeholder={hint(suggestion.reps, 0)}
          />
        </>
      )}

      {trackingType === "duration" && (
        <NumberField
          className={cn("flex-1 min-w-0", ring("duration"))}
          label={`${setName} time in seconds`}
          value={set.durationSec}
          onChange={(value) => onChange({ durationSec: value })}
          max={86_400}
          suffix="sec"
          placeholder={hint(suggestion.durationSec, 0)}
        />
      )}

      {trackingType === "cardio" && (
        <>
          <NumberField
            className={cn("flex-1 min-w-0", ring("duration"))}
            label={`${setName} time in minutes`}
            value={set.durationSec == null ? null : Math.round((set.durationSec / 60) * 10) / 10}
            onChange={(value) => onChange({ durationSec: value == null ? null : Math.round(value * 60) })}
            decimals={1}
            max={1440}
            suffix="min"
            placeholder={hint(suggestion.durationSec == null ? null : suggestion.durationSec / 60)}
          />
          <NumberField
            className="flex-1 min-w-0"
            label={`${setName} distance in kilometres`}
            value={set.distanceM == null ? null : Math.round(set.distanceM / 10) / 100}
            onChange={(value) => onChange({ distanceM: value == null ? null : Math.round(value * 1000) })}
            decimals={2}
            max={1000}
            suffix="km"
            placeholder={hint(suggestion.distanceM == null ? null : suggestion.distanceM / 1000, 2)}
          />
        </>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.done}
        aria-label={set.done ? `${setName} logged. Tap to undo` : `Log ${setName}`}
        className={cn(
          "grid place-items-center w-12 h-12 rounded-xl shrink-0 transition active:scale-95 cursor-pointer",
          set.done ? "bg-emerald-500 text-zinc-950" : "bg-surface-2 text-zinc-400"
        )}
      >
        <Check className="w-6 h-6" aria-hidden="true" />
      </button>
    </div>
  );
}

export default SetRow;
