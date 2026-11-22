"use client";

import React from "react";
import { ArrowDown, ArrowUp, Info, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { formatRestTime, restChoicesWith } from "@/lib/workouts/calc";
import type { WeightUnit } from "@/lib/fitness/units";
import type { SessionExerciseDTO } from "@/lib/workouts/types";

/** What the sheet edits: an exercise of a workout or of a routine. */
export type ExerciseOptionsTarget = Pick<SessionExerciseDTO, "name" | "unit" | "restSec" | "notes" | "trackingType">;

export interface ExerciseOptionsSheetProps {
  exercise: ExerciseOptionsTarget | undefined;
  isFirst: boolean;
  isLast: boolean;
  /** Rest only matters while the workout is live. */
  showRest: boolean;
  defaultRestSec: number;
  onClose: () => void;
  onMove: (direction: -1 | 1) => void;
  onUpdate: (patch: Partial<Pick<SessionExerciseDTO, "unit" | "restSec" | "notes">>) => void;
  onReplace: () => void;
  onRemove: () => void;
  onOpenDetail: () => void;
  /** "Remove from workout" / "Remove from routine". */
  removeLabel?: string;
}

/** One exercise's settings (live workout or routine): order, rest, unit, note, replace, remove. */
export function ExerciseOptionsSheet({
  exercise,
  isFirst,
  isLast,
  showRest,
  defaultRestSec,
  onClose,
  onMove,
  onUpdate,
  onReplace,
  onRemove,
  onOpenDetail,
  removeLabel = "Remove from workout",
}: ExerciseOptionsSheetProps) {
  const restSec = exercise?.restSec ?? defaultRestSec;
  const hasWeight = exercise?.trackingType === "weight_reps" || exercise?.trackingType === "bodyweight_reps";

  return (
    <Sheet isOpen={Boolean(exercise)} onClose={onClose} title={exercise?.name || "Exercise"}>
      {exercise && (
        <div className="space-y-4">
          {showRest && (
            <Select<number>
              label="Rest after each set"
              options={restChoicesWith(restSec).map((seconds) => ({ value: seconds, label: formatRestTime(seconds) }))}
              value={restSec}
              onChange={(value) => onUpdate({ restSec: value })}
            />
          )}

          {hasWeight && (
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-ink-2">Weight unit for this exercise</span>
              <SegmentedControl<WeightUnit>
                label="Weight unit"
                value={exercise.unit}
                options={[
                  { value: "kg", label: "Kilograms" },
                  { value: "lbs", label: "Pounds" },
                ]}
                onChange={(unit) => onUpdate({ unit })}
                className="w-full"
              />
              <p className="text-xs text-ink-3">Your numbers are converted, not changed.</p>
            </div>
          )}

          <Textarea
            label="Note"
            value={exercise.notes}
            onChange={(event) => onUpdate({ notes: event.target.value.slice(0, 500) })}
            rows={2}
            placeholder="Seat height, grip, how it felt…"
          />

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" startContent={<ArrowUp className="h-4 w-4" />} disabled={isFirst} onClick={() => onMove(-1)}>
              Move up
            </Button>
            <Button variant="secondary" startContent={<ArrowDown className="h-4 w-4" />} disabled={isLast} onClick={() => onMove(1)}>
              Move down
            </Button>
            <Button variant="secondary" startContent={<Info className="h-4 w-4" />} onClick={onOpenDetail}>
              Records and history
            </Button>
            <Button variant="secondary" startContent={<Repeat className="h-4 w-4" />} onClick={onReplace}>
              Replace
            </Button>
          </div>
          <Button variant="danger" fullWidth startContent={<Trash2 className="h-4 w-4" />} onClick={onRemove}>
            {removeLabel}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

export default ExerciseOptionsSheet;
