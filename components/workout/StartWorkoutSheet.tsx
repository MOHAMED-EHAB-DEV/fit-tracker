"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Play, Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button-styles";
import { Sheet } from "@/components/ui/Sheet";
import type { StartInput, StartResult } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { pluralize, relativeInstantLabel } from "@/lib/workouts/format";
import { cn } from "@/lib/utils";

/** The little the picker needs to know about a routine. */
export interface PickerRoutine {
  id: string;
  name: string;
  exerciseCount: number;
  lastPerformedAt: string | null;
}

export interface StartWorkoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  routines: PickerRoutine[];
  /** The routine the week plan has for today, shown first and marked. */
  plannedRoutineId: string | null;
  /** Today in the user's zone ("YYYY-MM-DD"), for "Last done". */
  today: string;
  /** From `useStartWorkout` in the same component (render its `dialog` there too). */
  starter: {
    start: (input: StartInput, key: string) => Promise<StartResult>;
    busyKey: string | null;
    isBusy: boolean;
    isNavigating: boolean;
  };
}

const ROW =
  "flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-elevated/60 active:bg-elevated disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

/**
 * Start any routine today, whatever the week plan says. The plan itself is
 * never changed: this only starts a workout. A workout that is already open is
 * handled by `useStartWorkout` (resume it or discard it).
 */
export function StartWorkoutSheet({ isOpen, onClose, routines, plannedRoutineId, today, starter }: StartWorkoutSheetProps) {
  const { timezone } = useUser();
  const [picked, setPicked] = useState<string | null>(null);

  // The planned routine first, the rest in the order of My routines.
  const ordered = plannedRoutineId
    ? [
        ...routines.filter((routine) => routine.id === plannedRoutineId),
        ...routines.filter((routine) => routine.id !== plannedRoutineId),
      ]
    : routines;

  const choose = async (input: StartInput, key: string) => {
    setPicked(key);
    const result = await starter.start(input, key);
    // The sheet stays open while the workout opens; it gives way to the
    // "workout already open" sheet, and stays for another try after an error.
    if (result === "conflict") onClose();
    if (result !== "started") setPicked(null);
  };

  const isStarting = (key: string) => starter.busyKey === key || (picked === key && starter.isNavigating);
  const firstKey = ordered.find((routine) => routine.exerciseCount > 0)?.id ?? "empty";

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => {
        if (!starter.isBusy) onClose();
      }}
      title="Start a workout"
      description="Any routine, any day. Your week plan stays as it is."
      size="md"
      closeOnBackdropClick={!starter.isBusy}
    >
      {ordered.length > 0 ? (
        <ul aria-label="Routines" className="divide-y divide-line overflow-hidden rounded-control border border-line">
          {ordered.map((routine) => {
            const key = `pick:${routine.id}`;
            const isPlanned = routine.id === plannedRoutineId;
            const lastDone = relativeInstantLabel(routine.lastPerformedAt, today, timezone);
            const detail = (
              <span className="mt-0.5 block truncate text-xs text-ink-3">
                {isPlanned && <span className="font-medium text-accent">Planned for today · </span>}
                {pluralize(routine.exerciseCount, "exercise")} ·{" "}
                {lastDone ? `Last done ${lastDone.toLowerCase()}` : "Not done yet"}
              </span>
            );

            if (routine.exerciseCount === 0) {
              return (
                <li key={routine.id}>
                  <Link href={`/workouts/routines/${routine.id}`} className={ROW}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{routine.name}</span>
                      {detail}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-2">
                      Add exercises
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            }

            const starting = isStarting(key);
            return (
              <li key={routine.id}>
                <button
                  type="button"
                  disabled={starter.isBusy}
                  aria-busy={starting || undefined}
                  data-autofocus={routine.id === firstKey ? "" : undefined}
                  onClick={() => void choose({ routineId: routine.id }, key)}
                  className={ROW}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{routine.name}</span>
                    {detail}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-ink-2">
                    {starting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {starting ? "Starting…" : "Start"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-control border border-dashed border-line-strong px-3.5 py-4 text-center">
          <p className="text-sm font-medium text-ink">No routines yet</p>
          <p className="mt-0.5 text-[13px] text-ink-2">A routine is a workout you repeat, like “Push day”.</p>
          <Link href="/workouts" className={cn(buttonClasses({ variant: "secondary" }), "mt-3")}>
            Create a routine
          </Link>
        </div>
      )}

      <button
        type="button"
        disabled={starter.isBusy}
        aria-busy={isStarting("pick:empty") || undefined}
        data-autofocus={firstKey === "empty" ? "" : undefined}
        onClick={() => void choose({}, "pick:empty")}
        className={cn(ROW, "mt-2 rounded-control border border-line")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-elevated text-ink-2" aria-hidden="true">
          {isStarting("pick:empty") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Empty workout</span>
          <span className="mt-0.5 block text-xs text-ink-3">Add exercises as you go</span>
        </span>
      </button>
    </Sheet>
  );
}

export default StartWorkoutSheet;
