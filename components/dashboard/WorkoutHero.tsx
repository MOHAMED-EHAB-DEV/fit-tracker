"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, ListChecks, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Surface } from "@/components/ui/Surface";
import { StartWorkoutSheet, type PickerRoutine } from "@/components/workout/StartWorkoutSheet";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { useElapsed } from "@/hooks/useElapsed";
import { formatDuration, formatDurationShort } from "@/lib/workouts/calc";
import { pluralize } from "@/lib/workouts/format";
import { cn } from "@/lib/utils";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

export interface TrainingWeekDay {
  date: string;
  /** One letter ("S"). */
  letter: string;
  /** Full name for screen readers ("Saturday"). */
  name: string;
  isToday: boolean;
  trained: boolean;
  routineName: string | null;
  isRestDay: boolean;
}

export interface WorkoutHeroProps {
  active: SessionSummaryDTO | null;
  /** The routine planned for today, with its size when known. */
  todayRoutine: { id: string; name: string; exerciseCount: number | null; setCount: number | null } | null;
  isRestDay: boolean;
  /** Workouts finished today, newest first. */
  doneToday: SessionSummaryDTO[];
  week: TrainingWeekDay[];
  /** Every routine, so any of them can be started today whatever the plan says. */
  routines: PickerRoutine[];
  /** Today in the user's zone ("YYYY-MM-DD"). */
  today: string;
}

function WeekStrip({ week }: { week: TrainingWeekDay[] }) {
  return (
    <ol className="mb-3 grid grid-cols-7 gap-1.5 border-b border-line pb-3" aria-label="This week">
      {week.map((day) => (
        <li
          key={day.date}
          className={cn(
            "flex flex-col items-center gap-[5px] text-xs",
            day.isToday ? "font-semibold text-ink" : "text-ink-3"
          )}
        >
          <span aria-hidden="true">{day.letter}</span>
          <span
            aria-hidden="true"
            className={cn("h-1 w-[18px] rounded-[2px]", day.trained ? "bg-ink" : day.isToday ? "bg-accent" : "bg-elevated")}
          />
          <span className="sr-only">
            {day.name}
            {day.isToday ? " (today)" : ""}:{" "}
            {day.trained ? "trained" : day.routineName ? `planned, ${day.routineName}` : day.isRestDay ? "rest day" : "nothing planned"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Today's training, adapted to the day: in progress (Resume), planned (Start
 * workout), done (summary), rest day, or nothing planned (Plan your week).
 * Except while a workout is open, any routine can be started from the picker.
 */
export function WorkoutHero({ active, todayRoutine, isRestDay, doneToday, week, routines, today }: WorkoutHeroProps) {
  const starter = useStartWorkout(active);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const openPicker = () => setIsPickerOpen(true);
  const elapsed = useElapsed(active && !active.isPastLog ? active.startedAt : null);
  const done = doneToday[0] ?? null;

  let body: React.ReactNode;
  if (active) {
    body = (
      <>
        <p className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
          <span className="h-[7px] w-[7px] rounded-full bg-accent animate-live" aria-hidden="true" />
          {active.isPastLog ? (
            "Unfinished workout log"
          ) : (
            <>
              In progress ·{" "}
              <span className="font-mono tabular-nums" suppressHydrationWarning>
                {formatDuration(elapsed)}
              </span>
            </>
          )}
        </p>
        <h2 className="truncate text-lg font-semibold tracking-[-0.015em] text-ink">{active.name}</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          <span className="font-mono tabular-nums">
            {active.totals.completedSets} / {active.totals.totalSets}
          </span>{" "}
          sets logged
        </p>
        <Button
          size="lg"
          fullWidth
          startContent={<Play className="h-4 w-4" />}
          isLoading={starter.isNavigating}
          onClick={() => starter.open(active.id)}
        >
          Resume
        </Button>
      </>
    );
  } else if (done) {
    body = (
      <>
        <p className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Done today
        </p>
        <h2 className="truncate text-lg font-semibold tracking-[-0.015em] text-ink">{done.name}</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          {formatDurationShort(done.durationSec)} · {pluralize(done.totals.completedSets, "set")}
          {done.totals.prCount > 0 && (
            <span className="text-warn"> · {pluralize(done.totals.prCount, "new record")}</span>
          )}
          {doneToday.length > 1 && <span className="text-ink-3"> · {doneToday.length} workouts today</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/workouts/history/${done.id}`} className={buttonClasses({ variant: "secondary" })}>
            View summary
          </Link>
          <Button variant="ghost" aria-haspopup="dialog" disabled={starter.isBusy} onClick={openPicker}>
            Start another
          </Button>
        </div>
      </>
    );
  } else if (todayRoutine) {
    const size = [
      todayRoutine.exerciseCount !== null ? pluralize(todayRoutine.exerciseCount, "exercise") : null,
      todayRoutine.setCount !== null ? pluralize(todayRoutine.setCount, "set") : null,
    ].filter(Boolean);
    body = (
      <>
        <div className="mb-0.5 flex items-baseline justify-between gap-3">
          <h2 className="truncate text-lg font-semibold tracking-[-0.015em] text-ink">{todayRoutine.name}</h2>
          <span className="shrink-0 text-xs text-ink-3">Scheduled</span>
        </div>
        <p className="mb-3 text-[13px] text-ink-2">{size.length > 0 ? size.join(" · ") : "Planned for today"}</p>
        <Button
          size="lg"
          fullWidth
          startContent={<Play className="h-4 w-4" />}
          isLoading={starter.busyKey === "today" || (starter.isNavigating && !isPickerOpen)}
          disabled={starter.isBusy}
          onClick={() => void starter.start({ routineId: todayRoutine.id }, "today")}
        >
          Start workout
        </Button>
        <Button
          variant="ghost"
          fullWidth
          className="mt-1.5"
          aria-haspopup="dialog"
          startContent={<ListChecks className="h-4 w-4" />}
          disabled={starter.isBusy}
          onClick={openPicker}
        >
          Start a different workout
        </Button>
      </>
    );
  } else if (isRestDay) {
    body = (
      <>
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">Rest day</h2>
        <p className="mb-3 text-[13px] text-ink-2">Recovery is part of training. You can still start a workout.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" aria-haspopup="dialog" disabled={starter.isBusy} onClick={openPicker}>
            Start a workout
          </Button>
          <Button
            variant="ghost"
            isLoading={starter.busyKey === "empty" || (starter.isNavigating && !isPickerOpen)}
            disabled={starter.isBusy}
            onClick={() => void starter.start({}, "empty")}
          >
            Empty workout
          </Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">Nothing planned today</h2>
        <p className="mb-3 text-[13px] text-ink-2">Start any routine, or give each day of the week a routine or a rest day.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" aria-haspopup="dialog" disabled={starter.isBusy} onClick={openPicker}>
            Start a workout
          </Button>
          <Link href="/workouts" className={buttonClasses({ variant: "ghost" })}>
            Plan your week
          </Link>
        </div>
      </>
    );
  }

  return (
    <Surface as="section" aria-label="Today's workout">
      <WeekStrip week={week} />
      {body}
      {!active && (
        <StartWorkoutSheet
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          routines={routines}
          plannedRoutineId={todayRoutine?.id ?? null}
          today={today}
          starter={starter}
        />
      )}
      {starter.dialog}
    </Surface>
  );
}

export default WorkoutHero;
