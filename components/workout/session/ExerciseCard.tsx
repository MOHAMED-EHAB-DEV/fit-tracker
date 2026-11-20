"use client";

import React from "react";
import { MoreVertical, Plus } from "lucide-react";
import { SetRow } from "@/components/workout/session/SetRow";
import { describeSet, setOrdinals } from "@/lib/workouts/format";
import { suggestedValues } from "@/lib/workouts/session-state";
import { formatDateString, localDateString } from "@/lib/time";
import type { PreviousPerformanceDTO, SessionExerciseDTO, SessionSetDTO } from "@/lib/workouts/types";

interface ExerciseCardProps {
  exercise: SessionExerciseDTO;
  position: number;
  previous: PreviousPerformanceDTO | undefined;
  /** False when editing a finished workout: "last time" would be misleading there. */
  showPrevious?: boolean;
  timezone: string;
  missing: { setId: string; field: "weight" | "reps" | "duration" } | null;
  onUpdateSet: (setId: string, patch: Partial<SessionSetDTO>) => void;
  onToggleSet: (setId: string) => void;
  onOpenSetOptions: (setId: string) => void;
  onAddSet: () => void;
  onOpenOptions: () => void;
  onOpenDetail: () => void;
}

/** One exercise in the live workout: last time's result, its sets, add set. */
export function ExerciseCard({
  exercise,
  position,
  previous,
  showPrevious = true,
  timezone,
  missing,
  onUpdateSet,
  onToggleSet,
  onOpenSetOptions,
  onAddSet,
  onOpenOptions,
  onOpenDetail,
}: ExerciseCardProps) {
  const ordinals = setOrdinals(exercise.sets);

  const lastTime = previous
    ? `${previous.sets
        .filter((set) => set.type !== "warmup")
        .slice(0, 5)
        .map((set) => describeSet(set, exercise.unit))
        .join(" · ")}`
    : null;
  const lastDate = previous
    ? formatDateString(localDateString(new Date(previous.performedAt), timezone), { month: "short", day: "numeric" })
    : null;

  return (
    <article className="rounded-3xl border border-line bg-surface p-3 sm:p-4">
      <header className="flex items-start gap-2 ps-1.5">
        <button type="button" onClick={onOpenDetail} className="flex-1 min-w-0 text-start cursor-pointer rounded-lg">
          <h3 className="text-base font-semibold text-white">
            <span className="text-zinc-400 tabular-nums">{position}. </span>
            {exercise.name}
          </h3>
          <p className="text-sm text-zinc-400 truncate">
            {!showPrevious ? (
              exercise.primaryMuscle
            ) : lastTime ? (
              <>
                Last time ({lastDate}): <span className="tabular-nums">{lastTime}</span>
              </>
            ) : (
              "First time: no earlier result"
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenOptions}
          aria-label={`Options for ${exercise.name}`}
          className="grid place-items-center w-11 h-11 rounded-full text-zinc-300 active:bg-white/10 shrink-0 cursor-pointer"
        >
          <MoreVertical className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {exercise.notes && <p className="mt-1 ps-1.5 text-sm text-amber-200/90">{exercise.notes}</p>}

      <div className="mt-2 space-y-1">
        {exercise.sets.map((set, index) => {
          const ordinal = ordinals[index];
          return (
            <SetRow
              key={set.id}
              set={set}
              ordinal={ordinal}
              exerciseName={exercise.name}
              trackingType={exercise.trackingType}
              unit={exercise.unit}
              suggestion={suggestedValues(exercise, index, previous)}
              missing={missing?.setId === set.id ? missing.field : null}
              onChange={(patch) => onUpdateSet(set.id, patch)}
              onToggle={() => onToggleSet(set.id)}
              onOpenOptions={() => onOpenSetOptions(set.id)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 flex w-full items-center justify-center gap-2 min-h-11 rounded-xl text-sm font-semibold text-emerald-300 active:bg-white/5 cursor-pointer"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add set
      </button>
    </article>
  );
}

export default ExerciseCard;
