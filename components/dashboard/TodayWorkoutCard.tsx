"use client";

import React from "react";
import Link from "next/link";
import { Check, ChevronRight, Dumbbell, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { cn } from "@/lib/utils";
import { formatDurationShort } from "@/lib/workouts/calc";
import { pluralize } from "@/lib/workouts/format";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

export interface TrainingWeekDay {
  date: string;
  /** "Sat" */
  label: string;
  isToday: boolean;
  trained: boolean;
  /** The routine planned for the day, if any. */
  routineName: string | null;
  isRestDay: boolean;
}

interface TodayWorkoutCardProps {
  active: SessionSummaryDTO | null;
  /** The routine planned for today, if any. */
  todayRoutine: { id: string; name: string } | null;
  isRestDay: boolean;
  doneToday: SessionSummaryDTO[];
  /** Workouts finished this week (a day can hold more than one). */
  workoutsThisWeek: number;
  week: TrainingWeekDay[];
}

/** Today's training on the dashboard: resume, start what is planned, or see what was done. */
export function TodayWorkoutCard({
  active,
  todayRoutine,
  isRestDay,
  doneToday,
  workoutsThisWeek,
  week,
}: TodayWorkoutCardProps) {
  const starter = useStartWorkout(active);
  const planned = week.filter((day) => day.routineName);
  const plannedDone = planned.filter((day) => day.trained).length;

  return (
    <section aria-labelledby="today-workout-title" className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-workout-title" className="flex items-center gap-2 text-base font-bold text-white">
          <Dumbbell className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          Training
        </h2>
        <Link
          href="/workouts"
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-emerald-300"
        >
          Open Train
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-1">
        {active ? (
          <>
            <p className="text-sm font-semibold text-emerald-300">
              {active.isPastLog ? "Unfinished workout log" : "Workout in progress"}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-white">{active.name}</p>
            <p className="text-sm text-zinc-400">
              {active.totals.completedSets} of {pluralize(active.totals.totalSets, "set")} logged
            </p>
            <Button
              size="lg"
              className="mt-3 w-full sm:w-auto"
              startContent={<Play className="h-5 w-5" />}
              isLoading={starter.isNavigating}
              onClick={() => starter.open(active.id)}
            >
              Resume workout
            </Button>
          </>
        ) : doneToday.length > 0 ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Check className="h-4 w-4" aria-hidden="true" />
              Done today
            </p>
            <ul className="mt-1">
              {doneToday.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/workouts/history/${session.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl active:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold text-white">{session.name}</span>
                      <span className="block text-sm text-zinc-400">
                        {formatDurationShort(session.durationSec)} · {pluralize(session.totals.completedSets, "set")}
                        {session.totals.prCount > 0 ? ` · ${pluralize(session.totals.prCount, "record")}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : todayRoutine ? (
          <>
            <p className="text-sm text-zinc-400">Planned for today</p>
            <p className="mt-0.5 truncate text-lg font-bold text-white">{todayRoutine.name}</p>
            <Button
              size="lg"
              className="mt-3 w-full sm:w-auto"
              startContent={<Play className="h-5 w-5" />}
              isLoading={starter.busyKey === "today" || starter.isNavigating}
              disabled={starter.isBusy}
              onClick={() => void starter.start({ routineId: todayRoutine.id }, "today")}
            >
              Start workout
            </Button>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-white">{isRestDay ? "Rest day" : "Nothing planned today"}</p>
            <p className="text-sm text-zinc-400">
              {isRestDay ? "Recovery is part of training." : "Pick a routine or start an empty workout in Train."}
            </p>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-sm text-zinc-400">
          This week: <span className="font-semibold text-white">{pluralize(workoutsThisWeek, "workout")}</span>
          {planned.length > 0 ? ` · ${plannedDone} of ${pluralize(planned.length, "planned day")} done` : ""}
        </p>
        <ol className="mt-2 grid grid-cols-7 gap-1">
          {week.map((day) => (
            <li key={day.date} className="flex flex-col items-center gap-1">
              <span className={cn("text-xs", day.isToday ? "font-bold text-emerald-300" : "text-zinc-400")}>
                {day.label}
              </span>
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border text-zinc-950",
                  day.trained
                    ? "border-emerald-500 bg-emerald-500"
                    : day.routineName
                      ? "border-emerald-500/60 bg-transparent"
                      : "border-line bg-transparent",
                  day.isToday && !day.trained && "ring-1 ring-emerald-400/60"
                )}
              >
                {day.trained && <Check className="h-4 w-4" aria-hidden="true" />}
                <span className="sr-only">
                  {day.trained
                    ? "Trained"
                    : day.routineName
                      ? `Planned: ${day.routineName}`
                      : day.isRestDay
                        ? "Rest day"
                        : "Nothing planned"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {starter.dialog}
    </section>
  );
}

export default TodayWorkoutCard;
