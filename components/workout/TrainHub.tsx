"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  History,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { announceActiveSessionChange } from "@/components/workout/ActiveSessionBar";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { useStartWorkout, type StartInput } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { cn } from "@/lib/utils";
import { formatVolume } from "@/lib/fitness/units";
import { formatTimeInZone, type WeekdayKey } from "@/lib/time";
import { formatDurationShort } from "@/lib/workouts/calc";
import {
  muscleGroupSummary,
  pluralize,
  relativeDayLabel,
  relativeInstantLabel,
  toDateTimeLocalValue,
} from "@/lib/workouts/format";
import { clearDraft, pruneDrafts } from "@/lib/workouts/session-state";
import type {
  RoutineDTO,
  RoutineSummaryDTO,
  SessionSummaryDTO,
  WeeklyScheduleDayDTO,
} from "@/lib/workouts/types";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  exerciseCount: number;
}

interface TrainHubProps {
  active: SessionSummaryDTO | null;
  routines: RoutineSummaryDTO[];
  /** Seven days, in the user's week order. */
  schedule: WeeklyScheduleDayDTO[];
  /** Calendar dates of this week, in the same order as `schedule`. */
  weekDates: string[];
  today: string;
  todayKey: WeekdayKey;
  /** Workouts finished this week. */
  weekSessions: SessionSummaryDTO[];
  recent: SessionSummaryDTO[];
  templates: TemplateSummary[];
}

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

const SECTION_TITLE = "text-lg font-bold text-white";
const CARD = "rounded-3xl border border-line bg-surface p-4";

/** The Train tab: resume or start a workout, routines, the week plan, recent workouts. */
export function TrainHub({
  active,
  routines,
  schedule,
  weekDates,
  today,
  todayKey,
  weekSessions,
  recent,
  templates,
}: TrainHubProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { weightUnit, timezone } = useUser();
  const [isNavigating, startNavigation] = useTransition();
  const [, startRefresh] = useTransition();
  const starter = useStartWorkout(active);

  const [busy, setBusy] = useState<string | null>(null);
  const [menuRoutine, setMenuRoutine] = useState<RoutineSummaryDTO | null>(null);
  const [routineToDelete, setRoutineToDelete] = useState<RoutineSummaryDTO | null>(null);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<WeekdayKey | null>(null);
  const [plan, setPlan] = useState<{ source: WeeklyScheduleDayDTO[]; days: WeeklyScheduleDayDTO[] }>({
    source: schedule,
    days: schedule,
  });
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPastOpen, setIsPastOpen] = useState(false);
  const [pastStart, setPastStart] = useState("");
  const [pastRoutineId, setPastRoutineId] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Fresh server data replaces the optimistic copy of the week plan.
  if (plan.source !== schedule) setPlan({ source: schedule, days: schedule });
  const days = plan.days;

  const isBusy = busy !== null || isNavigating || starter.isBusy;
  const startKey = starter.busyKey;
  const start = (input: StartInput, key: string) => void starter.start(input, key);
  const refresh = () => startRefresh(() => router.refresh());

  // Drafts of workouts that are no longer running are removed from this device.
  useEffect(() => {
    pruneDrafts(active?.id ?? null);
  }, [active?.id]);

  const todayPlan = days.find((day) => day.dayOfWeek === todayKey);
  const doneToday = weekSessions.filter((session) => session.localDate === today);
  const doneDates = new Set(weekSessions.map((session) => session.localDate));

  const discardSession = async (sessionId: string): Promise<boolean> => {
    setBusy("discard");
    setDialogError(null);
    try {
      await api(`/api/sessions/${sessionId}`, { method: "DELETE" });
      clearDraft(sessionId);
      markDashboardStale();
      announceActiveSessionChange();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        announceActiveSessionChange();
        return true;
      }
      setDialogError(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const createRoutine = async (body: { name: string; templateId?: string }, key: string) => {
    if (isBusy) return;
    setBusy(key);
    setDialogError(null);
    try {
      const data = await api<{ routine: RoutineDTO; skipped: string[] }>("/api/routines", { method: "POST", body });
      if (data.skipped.length > 0) {
        toast(
          `${pluralize(data.skipped.length, "exercise")} from this template ${data.skipped.length === 1 ? "is" : "are"} not in the library and ${data.skipped.length === 1 ? "was" : "were"} left out.`,
          "warning"
        );
      }
      setIsNewOpen(false);
      startNavigation(() => router.push(`/workouts/routines/${data.routine.id}`));
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const duplicateRoutine = async (routine: RoutineSummaryDTO) => {
    setMenuRoutine(null);
    setBusy(`duplicate:${routine.id}`);
    try {
      await api(`/api/routines/${routine.id}/duplicate`, { method: "POST" });
      toast("Routine duplicated", "success");
      refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const deleteRoutine = async () => {
    if (!routineToDelete) return;
    setBusy("delete-routine");
    setDialogError(null);
    try {
      await api(`/api/routines/${routineToDelete.id}`, { method: "DELETE" });
      setRoutineToDelete(null);
      toast("Routine deleted", "success");
      refresh();
    } catch (err) {
      setDialogError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const setDayPlan = async (dayOfWeek: WeekdayKey, choice: { routineId: string | null; isRestDay: boolean }) => {
    const before = plan;
    const routine = choice.routineId ? routines.find((item) => item.id === choice.routineId) : undefined;
    const next = days.map((day) =>
      day.dayOfWeek === dayOfWeek
        ? { ...day, routineId: routine?.id ?? null, routineName: routine?.name ?? null, isRestDay: !routine && choice.isRestDay }
        : day
    );
    setPlan({ source: schedule, days: next });
    setEditingDay(null);
    try {
      markDashboardStale();
      await api("/api/user/weekly-routine", {
        method: "PUT",
        body: {
          days: next.map((day) => ({ dayOfWeek: day.dayOfWeek, routineId: day.routineId, isRestDay: day.isRestDay })),
        },
      });
      refresh();
    } catch (err) {
      setPlan(before);
      toast(errorMessage(err, "The week plan could not be saved."), "error");
    }
  };

  const openPastWorkout = () => {
    setPastStart(toDateTimeLocalValue(new Date(Date.now() - 60 * 60_000)));
    setPastRoutineId("");
    setDialogError(null);
    setIsPastOpen(true);
  };

  const startPastWorkout = () => {
    const startedAt = new Date(pastStart);
    if (Number.isNaN(startedAt.getTime())) {
      setDialogError("Choose the date and time of the workout.");
      return;
    }
    if (startedAt.getTime() > Date.now()) {
      setDialogError("That time is in the future. Choose when the workout actually happened.");
      return;
    }
    setIsPastOpen(false);
    start({ startedAt: startedAt.toISOString(), ...(pastRoutineId ? { routineId: pastRoutineId } : {}) }, "past");
  };

  const editingDayPlan = editingDay ? days.find((day) => day.dayOfWeek === editingDay) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Train</h1>
        <Link
          href="/workouts/history"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-300 active:bg-white/5"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          History
        </Link>
      </header>

      {/* What to do now */}
      <section aria-label="Today">
        {active ? (
          <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/60 p-5">
            <p className="text-sm font-semibold text-emerald-300">
              {active.isPastLog ? "Unfinished workout log" : "Workout in progress"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">{active.name}</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Started {relativeDayLabel(active.localDate, today).toLowerCase()} at{" "}
              {formatTimeInZone(active.startedAt, timezone)} · {active.totals.completedSets} of{" "}
              {pluralize(active.totals.totalSets, "set")} logged
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                size="lg"
                className="flex-1"
                startContent={<Play className="h-5 w-5" />}
                isLoading={starter.isNavigating}
                onClick={() => starter.open(active.id)}
              >
                Resume
              </Button>
              <Button
                size="lg"
                variant="bordered"
                className="text-red-300 border-red-500/30"
                onClick={() => {
                  setDialogError(null);
                  setIsDiscardOpen(true);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        ) : (
          <div className={CARD}>
            {doneToday.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Done today
                </p>
                <ul className="mt-2 space-y-1">
                  {doneToday.map((session) => (
                    <li key={session.id}>
                      <Link
                        href={`/workouts/history/${session.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl active:bg-white/5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-semibold text-white">{session.name}</span>
                          <span className="block text-sm text-zinc-400">
                            {formatDurationShort(session.durationSec)} · {pluralize(session.totals.completedSets, "set")}
                            {session.totals.volumeKg > 0 ? ` · ${formatVolume(session.totals.volumeKg, weightUnit)}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : todayPlan?.routineId ? (
              <>
                <p className="text-sm text-zinc-400">Planned for today</p>
                <h2 className="mt-1 text-xl font-bold text-white">{todayPlan.routineName}</h2>
                <Button
                  size="lg"
                  className="mt-4 w-full"
                  startContent={<Play className="h-5 w-5" />}
                  isLoading={startKey === "today"}
                  disabled={isBusy}
                  onClick={() => start({ routineId: todayPlan.routineId as string }, "today")}
                >
                  Start workout
                </Button>
              </>
            ) : todayPlan?.isRestDay ? (
              <>
                <h2 className="text-xl font-bold text-white">Rest day</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Nothing is planned for today. You can still start any workout below.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">Nothing planned today</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {routines.length > 0
                    ? "Start one of your routines below, or an empty workout."
                    : "Create your first routine, or just start an empty workout and add exercises as you go."}
                </p>
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant={todayPlan?.routineId && doneToday.length === 0 ? "bordered" : "flat"}
                isLoading={startKey === "empty"}
                disabled={isBusy}
                onClick={() => start({}, "empty")}
              >
                Empty workout
              </Button>
              <Button variant="bordered" disabled={isBusy} isLoading={startKey === "past"} onClick={openPastWorkout}>
                Log a past workout
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Routines */}
      <section aria-labelledby="routines-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="routines-title" className={SECTION_TITLE}>
            My routines
          </h2>
          <Button
            variant="flat"
            size="sm"
            startContent={<Plus className="h-4 w-4" />}
            onClick={() => {
              setNewName("");
              setDialogError(null);
              setIsNewOpen(true);
            }}
          >
            New
          </Button>
        </div>

        {routines.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-base font-semibold text-white">No routines yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              A routine is a workout you repeat, like &ldquo;Push day&rdquo;. Create one, or start from a template.
            </p>
            <Button
              className="mt-4"
              startContent={<Plus className="h-4 w-4" />}
              onClick={() => {
                setNewName("");
                setDialogError(null);
                setIsNewOpen(true);
              }}
            >
              Create a routine
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {routines.map((routine) => {
              const lastDone = relativeInstantLabel(routine.lastPerformedAt, today, timezone);
              const groups = muscleGroupSummary(routine.muscleGroups);
              return (
                <li key={routine.id} className={CARD}>
                  <div className="flex items-start gap-2">
                    <Link href={`/workouts/routines/${routine.id}`} className="min-w-0 flex-1 rounded-lg">
                      <h3 className="truncate text-base font-semibold text-white">{routine.name}</h3>
                      <p className="text-sm text-zinc-400">
                        {pluralize(routine.exerciseCount, "exercise")}
                        {groups ? ` · ${groups}` : ""}
                      </p>
                      {routine.exerciseNames.length > 0 && (
                        <p className="truncate text-sm text-zinc-400">{routine.exerciseNames.join(", ")}</p>
                      )}
                      <p className="mt-1 text-xs text-zinc-400">
                        {lastDone ? `Last done ${lastDone.toLowerCase()}` : "Not done yet"}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMenuRoutine(routine)}
                      aria-label={`More options for ${routine.name}`}
                      aria-haspopup="dialog"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-300 active:bg-white/10 cursor-pointer"
                    >
                      <MoreVertical className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  {routine.exerciseCount === 0 ? (
                    <Link
                      href={`/workouts/routines/${routine.id}`}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-zinc-200 active:bg-white/5"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add exercises
                    </Link>
                  ) : (
                    <Button
                      className="mt-3 w-full"
                      variant={todayPlan?.routineId === routine.id || !todayPlan?.routineId ? "flat" : "bordered"}
                      startContent={<Play className="h-4 w-4" />}
                      isLoading={startKey === `start:${routine.id}`}
                      disabled={isBusy}
                      onClick={() => start({ routineId: routine.id }, `start:${routine.id}`)}
                    >
                      Start
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Week plan */}
      <section aria-labelledby="week-title" className="space-y-3">
        <div>
          <h2 id="week-title" className={SECTION_TITLE}>
            Week plan
          </h2>
          <p className="text-sm text-zinc-400">Tap a day to choose its routine. A tick means you trained that day.</p>
        </div>
        <ul className={cn(CARD, "divide-y divide-line p-0")}>
          {days.map((day, index) => {
            const date = weekDates[index];
            const isToday = day.dayOfWeek === todayKey;
            const isDone = date ? doneDates.has(date) : false;
            return (
              <li key={day.dayOfWeek}>
                <button
                  type="button"
                  onClick={() => setEditingDay(day.dayOfWeek as WeekdayKey)}
                  aria-haspopup="dialog"
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-start active:bg-white/5 cursor-pointer"
                >
                  <span className={cn("w-24 shrink-0 text-sm font-semibold", isToday ? "text-emerald-300" : "text-zinc-300")}>
                    {WEEKDAY_LABELS[day.dayOfWeek as WeekdayKey]}
                    {isToday && <span className="block text-xs font-medium">Today</span>}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-base",
                      day.routineName ? "font-medium text-white" : "text-zinc-400"
                    )}
                  >
                    {day.routineName || (day.isRestDay ? "Rest" : "Not planned")}
                  </span>
                  {isDone && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-zinc-950">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Trained</span>
                    </span>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Recent workouts */}
      <section aria-labelledby="recent-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-title" className={SECTION_TITLE}>
            Recent workouts
          </h2>
          {recent.length > 0 && (
            <Link
              href="/workouts/history"
              className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-emerald-300"
            >
              See all
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-sm text-zinc-400">
            Your finished workouts will appear here.
          </p>
        ) : (
          <ul className={cn(CARD, "divide-y divide-line p-0")}>
            {recent.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workouts/history/${session.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-white/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-white">{session.name}</span>
                    <span className="block text-sm text-zinc-400">
                      {relativeDayLabel(session.localDate, today)} · {formatDurationShort(session.durationSec)} ·{" "}
                      {pluralize(session.totals.completedSets, "set")}
                    </span>
                  </span>
                  {session.totals.prCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-300">
                      <Trophy className="h-4 w-4" aria-hidden="true" />
                      {session.totals.prCount}
                      <span className="sr-only">personal records</span>
                    </span>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="More">
        <Button
          variant="bordered"
          className="w-full"
          startContent={<BookOpen className="h-4 w-4" />}
          onClick={() => setIsLibraryOpen(true)}
        >
          Exercise library
        </Button>
      </section>

      <ExercisePicker isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} mode="browse" />

      {/* Routine menu */}
      <Drawer
        isOpen={Boolean(menuRoutine)}
        onClose={() => setMenuRoutine(null)}
        title={menuRoutine?.name || "Routine"}
        position="bottom"
      >
        {menuRoutine && (
          <div className="space-y-2">
            <Link
              href={`/workouts/routines/${menuRoutine.id}`}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base text-white active:bg-white/5"
            >
              <Pencil className="h-5 w-5 text-zinc-400" aria-hidden="true" />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void duplicateRoutine(menuRoutine)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base text-white active:bg-white/5 cursor-pointer"
            >
              <Copy className="h-5 w-5 text-zinc-400" aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                setDialogError(null);
                setRoutineToDelete(menuRoutine);
                setMenuRoutine(null);
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-base text-red-300 active:bg-red-500/10 cursor-pointer"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              Delete
            </button>
          </div>
        )}
      </Drawer>

      {/* Day plan */}
      <Drawer
        isOpen={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        title={editingDay ? WEEKDAY_LABELS[editingDay] : "Day"}
        description="What do you train on this day?"
        position="bottom"
      >
        {editingDay && (
          <div role="radiogroup" aria-label="Plan for this day" className="space-y-1">
            {routines.map((routine) => (
              <DayOption
                key={routine.id}
                label={routine.name}
                detail={pluralize(routine.exerciseCount, "exercise")}
                selected={editingDayPlan?.routineId === routine.id}
                onSelect={() => void setDayPlan(editingDay, { routineId: routine.id, isRestDay: false })}
              />
            ))}
            <DayOption
              label="Rest day"
              selected={!editingDayPlan?.routineId && Boolean(editingDayPlan?.isRestDay)}
              onSelect={() => void setDayPlan(editingDay, { routineId: null, isRestDay: true })}
            />
            <DayOption
              label="Not planned"
              selected={!editingDayPlan?.routineId && !editingDayPlan?.isRestDay}
              onSelect={() => void setDayPlan(editingDay, { routineId: null, isRestDay: false })}
            />
            {routines.length === 0 && (
              <p className="px-3 pt-2 text-sm text-zinc-400">Create a routine first to plan it on a day.</p>
            )}
          </div>
        )}
      </Drawer>

      {/* New routine */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => {
          if (!isBusy) setIsNewOpen(false);
        }}
        title="New routine"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const name = newName.trim();
            if (!name) {
              setDialogError("Give the routine a name.");
              return;
            }
            void createRoutine({ name }, "create");
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm text-zinc-300">Name</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value.slice(0, 80))}
              placeholder="Push day"
              autoComplete="off"
              className="w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-white placeholder:text-zinc-500"
            />
          </label>
          {dialogError && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {dialogError}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" isLoading={busy === "create"} disabled={isBusy}>
            Create and add exercises
          </Button>
        </form>

        {templates.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-300">Or start from a template</h3>
            <ul className="mt-2 space-y-2">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void createRoutine({ name: template.name, templateId: template.id }, `template:${template.id}`)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line px-3 py-2 text-start active:bg-white/5 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-white">{template.name}</span>
                      <span className="block text-sm text-zinc-400">
                        {pluralize(template.exerciseCount, "exercise")} · {template.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-emerald-300">
                      {busy === `template:${template.id}` ? "Adding…" : "Use"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      {/* Past workout */}
      <Modal
        isOpen={isPastOpen}
        onClose={() => setIsPastOpen(false)}
        title="Log a past workout"
        description="For a workout you already did. You will enter the exercises and sets next."
        size="md"
        footer={
          <>
            <Button variant="bordered" onClick={() => setIsPastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startPastWorkout}>Continue</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm text-zinc-300">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              When did it start?
            </span>
            <input
              type="datetime-local"
              value={pastStart}
              max={toDateTimeLocalValue(new Date())}
              onChange={(event) => setPastStart(event.target.value)}
              className="w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-white"
            />
          </label>
          {routines.length > 0 && (
            <label className="block space-y-1.5">
              <span className="text-sm text-zinc-300">Routine (optional)</span>
              <select
                value={pastRoutineId}
                onChange={(event) => setPastRoutineId(event.target.value)}
                className="w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-white"
              >
                <option value="">No routine: I will add the exercises</option>
                {routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {dialogError && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {dialogError}
            </p>
          )}
        </div>
      </Modal>

      {starter.dialog}

      <ConfirmDialog
        isOpen={isDiscardOpen}
        onCancel={() => setIsDiscardOpen(false)}
        onConfirm={async () => {
          if (!active) return;
          if (await discardSession(active.id)) {
            setIsDiscardOpen(false);
            toast("Workout discarded", "success");
            refresh();
          }
        }}
        title="Discard this workout?"
        message={`Everything logged in "${active?.name || "this workout"}" will be deleted. Your routines and past workouts are not affected.`}
        confirmLabel="Discard workout"
        cancelLabel="Keep it"
        destructive
        isWorking={busy === "discard"}
        error={dialogError}
      />

      <ConfirmDialog
        isOpen={Boolean(routineToDelete)}
        onCancel={() => setRoutineToDelete(null)}
        onConfirm={deleteRoutine}
        title={`Delete "${routineToDelete?.name || "routine"}"?`}
        message="The routine is removed from your list and from your week plan. Workouts you already logged with it stay in your history."
        confirmLabel="Delete routine"
        destructive
        isWorking={busy === "delete-routine"}
        error={dialogError}
      />
    </div>
  );
}

function DayOption({
  label,
  detail,
  selected,
  onSelect,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-start cursor-pointer",
        selected ? "bg-emerald-500/15" : "active:bg-white/5"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          selected ? "border-emerald-500 bg-emerald-500 text-zinc-950" : "border-zinc-500"
        )}
      >
        {selected && <Check className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-white">{label}</span>
        {detail && <span className="block text-sm text-zinc-400">{detail}</span>}
      </span>
    </button>
  );
}

export default TrainHub;
