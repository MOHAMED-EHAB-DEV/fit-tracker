"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { NumberField } from "@/components/ui/NumberField";
import { Popover } from "@/components/ui/Popover";
import { fromKg, toKg, type WeightUnit } from "@/lib/fitness/units";
import { SET_TYPES, SET_TYPE_LABELS, type SetType } from "@/lib/workouts/taxonomy";
import { cn } from "@/lib/utils";

const RPE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export interface SetBadgePatch {
  type?: SetType;
  rpe?: number | null;
  /** Added weight of a bodyweight set, in kg. */
  weightKg?: number | null;
}

export interface SetBadgeProps {
  /** "Set 2", "Warm-up 1". */
  setName: string;
  exerciseName: string;
  type: SetType;
  /** Position among sets of the same kind. */
  ordinal: number;
  /** Effort of the set (live) or the target effort (routine). */
  rpe: number | null;
  rpeLabel?: string;
  /** The accented look of the set that is up next. */
  highlighted?: boolean;
  /** Bodyweight exercises: the set's added weight, edited here. */
  addedWeight?: { valueKg: number | null; unit: WeightUnit } | null;
  onChange: (patch: SetBadgePatch) => void;
  onRemove: () => void;
}

/**
 * The set badge (number, W, D or F) in a ledger row. It opens a small
 * popover: set type, effort, added weight for bodyweight sets, Delete set.
 * Shared by the live workout and the routine editor.
 */
export function SetBadge({
  setName,
  exerciseName,
  type,
  ordinal,
  rpe,
  rpeLabel = "Effort (RPE, optional)",
  highlighted = false,
  addedWeight = null,
  onChange,
  onRemove,
}: SetBadgeProps) {
  const label = SET_TYPE_LABELS[type];
  const badge = type === "working" ? String(ordinal) : label.short;

  return (
    <Popover
      label={`${setName} of ${exerciseName}`}
      align="start"
      className="w-72 p-3"
      triggerLabel={`${setName}: type, effort, delete`}
      triggerClassName={cn(
        "relative grid h-9 w-9 place-items-center rounded-chip border text-[13px] font-semibold before:absolute before:-inset-1 before:content-['']",
        highlighted ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2",
        type === "working" && "font-mono"
      )}
      trigger={badge}
    >
      {({ close }) => (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-3">Set type</p>
            <div role="group" aria-label="Set type" className="grid grid-cols-2 gap-1.5">
              {SET_TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={type === option}
                  onClick={() => onChange({ type: option })}
                  className={cn(
                    "min-h-10 rounded-chip border px-2 text-[13px] font-medium transition-colors cursor-pointer",
                    type === option ? "border-ink bg-ink text-ink-inverse" : "border-line bg-elevated text-ink hover:border-line-strong"
                  )}
                >
                  {SET_TYPE_LABELS[option].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-3">{rpeLabel}</p>
            <div role="group" aria-label={rpeLabel} className="flex flex-wrap gap-1.5">
              {RPE_CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rpe === value}
                  onClick={() => onChange({ rpe: rpe === value ? null : value })}
                  className={cn(
                    "h-9 min-w-10 rounded-chip border px-2 font-mono text-[13px] tabular-nums transition-colors cursor-pointer",
                    rpe === value ? "border-ink bg-ink text-ink-inverse" : "border-line bg-elevated text-ink hover:border-line-strong"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {addedWeight && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-3">Added weight</p>
              <NumberField
                label={`${setName} added weight in ${addedWeight.unit}`}
                value={addedWeight.valueKg == null ? null : fromKg(addedWeight.valueKg, addedWeight.unit, 2)}
                onChange={(value) => onChange({ weightKg: value == null || value === 0 ? null : toKg(value, addedWeight.unit) })}
                decimals={2}
                max={addedWeight.unit === "lbs" ? 1000 : 500}
                step={addedWeight.unit === "lbs" ? 5 : 2.5}
                suffix={addedWeight.unit}
                placeholder="0"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              close();
              onRemove();
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-line bg-elevated text-sm font-semibold text-danger transition-colors hover:border-line-strong cursor-pointer"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete set
          </button>
        </div>
      )}
    </Popover>
  );
}

export default SetBadge;
