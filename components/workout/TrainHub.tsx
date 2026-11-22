"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, History, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Surface } from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";
import { announceActiveSessionChange } from "@/components/workout/ActiveSessionBar";
import { TrainNav } from "@/components/workout/TrainNav";
import { useStartWorkout, type StartInput } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { useElapsed } from "@/hooks/useElapsed";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { formatVolume } from "@/lib/fitness/units";
import { formatDateString, type WeekdayKey } from "@/lib/time";
import { formatDuration, formatDurationShort } from "@/lib/workouts/calc";
import { pluralize, relativeInstantLabel, toDateTimeLocalValue } from "@/lib/workouts/format";
import { clearDraft, pruneDrafts } from "@/lib/workouts/session-state";
import { cn } from "@/lib/utils";
import type { RoutineDTO, RoutineSummaryDTO, SessionSummaryDTO, WeeklyScheduleDayDTO } from "@/lib/workouts/types";

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

/** A routine's name in the 7-day strip: "Upper body A" -> "UBA", "Legs" -> "Legs" (the full name is in the label and tooltip). */
export function routineTag(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 5) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return trimmed.slice(0, 4);
  return words
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** The Train tab: today's workout, the week plan, routines. */
export function TrainHub({ active, routines, schedule, weekDates, today, todayKey, weekSessions, templates }: TrainHubProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { weightUnit, timezone } = useUser();
  const [isNavigating, startNavigation] = useTransition();
  const [, startRefresh] = useTransition();
  const starter = useStartWorkout(active);

  const [busy, setBusy] = useState<string | null>(null);
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

  // Fresh server data replaces the optimistic copy of the week plan.
  if (plan.source !== schedule) setPlan({ source: schedule, days: schedule });

  const isBusy = busy !== null || isNavigating || starter.isBusy;
  const startKey = starter.busyKey;
  const start = (input: StartInput, key: string) => void starter.start(input, key);
  const refresh = () => startRefresh(() => router.refresh());

  // Deleting a routine is instant with Undo; the server archives it when the undo window ends.
  const routineDelete = useUndoableDelete<RoutineSummaryDTO>({
    getId: (routine) => routine.id,
    commit: async (routine) => {
      await api(`/api/routines/${routine.id}`, { method: "DELETE", keepalive: true });
      markDashboardStale();
      refresh();
    },
    message: (routine) => `"${routine.name}" deleted`,
    onError: (_routine, error) => toast(errorMessage(error, "The routine could not be deleted."), "error"),
  });

  const visibleRoutines = routines.filter((routine) => !routineDelete.isHidden(routine.id));
  // A deleted routine also leaves the week plan.
  const days = plan.days.map((day) =>
    day.routineId && routineDelete.isHidden(day.routineId) ? { ...day, routineId: null, routineName: null } : day
  );

  // Drafts of workouts that are no longer running are removed from this device.
  useEffect(() => {
    pruneDrafts(active?.id ?? null);
  }, [active?.id]);

  const todayPlan = days.find((day) => day.dayOfWeek === todayKey);
  const todayRoutine = todayPlan?.routineId ? visibleRoutines.find((routine) => routine.id === todayPlan.routineId) : undefined;
  // Newest first (the week comes oldest first).
  const doneToday = weekSessions.filter((session) => session.localDate === today).reverse();
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

  const openNewRoutine = () => {
    setNewName("");
    setDialogError(null);
    setIsNewOpen(true);
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
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="lg:col-span-2">
        <TrainNav current="workouts" />
      </div>

      <div className="space-y-3">
        <TodayBar
          active={active}
          todayRoutine={todayRoutine ?? null}
          isRestDay={Boolean(todayPlan && !todayPlan.routineId && todayPlan.isRestDay)}
          doneToday={doneToday}
          volumeLabel={(session) => (session.totals.volumeKg > 0 ? formatVolume(session.totals.volumeKg, weightUnit) : null)}
          isBusy={isBusy}
          startKey={startKey}
          isResuming={starter.isNavigating}
          onResume={() => active && starter.open(active.id)}
          onDiscard={() => {
            setDialogError(null);
            setIsDiscardOpen(true);
          }}
          onStart={start}
          onLogPast={openPastWorkout}
        />

        <WeekPlan
          days={days}
          weekDates={weekDates}
          todayKey={todayKey}
          doneDates={doneDates}
          hasActive={Boolean(active && !active.isPastLog)}
          onEdit={setEditingDay}
        />
      </div>

      <section aria-labelledby="routines-title" className="space-y-2">
        <SectionHeader id="routines-title" title="My routines" meta={visibleRoutines.length > 0 ? String(visibleRoutines.length) : undefined} />

        {visibleRoutines.length === 0 ? (
          <EmptyState
            title="Build your first routine"
            description="A routine is a workout you repeat, like “Push day”. Create one, or start from a template."
            actions={
              <>
                <Button startContent={<Plus className="h-4 w-4" />} onClick={openNewRoutine}>
                  Create routine
                </Button>
                <Button variant="secondary" isLoading={startKey === "empty"} disabled={isBusy} onClick={() => start({}, "empty")}>
                  Start empty workout
                </Button>
              </>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {visibleRoutines.map((routine) => (
                <RoutineRow
                  key={routine.id}
                  routine={routine}
                  isActive={Boolean(active && active.routineId === routine.id)}
                  lastDone={relativeInstantLabel(routine.lastPerformedAt, today, timezone)}
                  isStarting={startKey === `start:${routine.id}`}
                  disabled={isBusy}
                  onStart={() => start({ routineId: routine.id }, `start:${routine.id}`)}
                  onDuplicate={() => void duplicateRoutine(routine)}
                  onDelete={() => routineDelete.remove(routine)}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={openNewRoutine}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition-colors hover:text-ink hover:border-ink-3 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New routine
            </button>
          </>
        )}
      </section>

      {/* Day plan */}
      <Sheet
        isOpen={Boolean(editingDay)}
        onClose={() => setEditingDay(null)}
        title={editingDay ? WEEKDAY_LABELS[editingDay] : "Day"}
        description="What do you train on this day?"
        size="sm"
      >
        {editingDay && (
          <div role="radiogroup" aria-label="Plan for this day" className="-mx-1 space-y-0.5">
            {visibleRoutines.map((routine) => (
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
            {visibleRoutines.length === 0 && (
              <p className="px-3 pt-2 text-sm text-ink-2">Create a routine first to plan it on a day.</p>
            )}
          </div>
        )}
      </Sheet>

      {/* New routine */}
      <Sheet
        isOpen={isNewOpen}
        onClose={() => {
          if (!isBusy) setIsNewOpen(false);
        }}
        title="New routine"
      >
        <form
          className="space-y-3"
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
          <Input
            label="Name"
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value.slice(0, 80));
              if (dialogError) setDialogError(null);
            }}
            placeholder="Push day"
            autoComplete="off"
            data-autofocus
            isInvalid={Boolean(dialogError)}
            errorMessage={dialogError ?? undefined}
          />
          <Button type="submit" size="lg" fullWidth isLoading={busy === "create"} disabled={isBusy}>
            Create and add exercises
          </Button>
        </form>

        {templates.length > 0 && (
          <section aria-labelledby="templates-title" className="mt-5 space-y-2">
            <SectionHeader as="h3" id="templates-title" title="Or start from a template" />
            <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void createRoutine({ name: template.name, templateId: template.id }, `template:${template.id}`)}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-elevated/60 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{template.name}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {pluralize(template.exerciseCount, "exercise")} · {template.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-ink-2">
                      {busy === `template:${template.id}` ? "Adding…" : "Use"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Sheet>

      {/* Past workout */}
      <Sheet
        isOpen={isPastOpen}
        onClose={() => setIsPastOpen(false)}
        title="Log a past workout"
        description="For a workout you already did. You enter the exercises and sets next."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setIsPastOpen(false)}>
              Cancel
            </Button>
            <Button onClick={startPastWorkout}>Continue</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="When did it start?"
            type="datetime-local"
            value={pastStart}
            max={toDateTimeLocalValue(new Date())}
            onChange={(event) => {
              setPastStart(event.target.value);
              if (dialogError) setDialogError(null);
            }}
            isInvalid={Boolean(dialogError)}
            errorMessage={dialogError ?? undefined}
          />
          {visibleRoutines.length > 0 && (
            <Select<string>
              label="Routine (optional)"
              options={[
                { value: "", label: "No routine: I will add the exercises" },
                ...visibleRoutines.map((routine) => ({ value: routine.id, label: routine.name })),
              ]}
              value={pastRoutineId}
              onChange={(value) => setPastRoutineId(value)}
            />
          )}
        </div>
      </Sheet>

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
    </div>
  );
}

interface TodayBarProps {
  active: SessionSummaryDTO | null;
  todayRoutine: RoutineSummaryDTO | null;
  isRestDay: boolean;
  /** Workouts finished today, newest first. */
  doneToday: SessionSummaryDTO[];
  volumeLabel: (session: SessionSummaryDTO) => string | null;
  isBusy: boolean;
  startKey: string | null;
  isResuming: boolean;
  onResume: () => void;
  onDiscard: () => void;
  onStart: (input: StartInput, key: string) => void;
  onLogPast: () => void;
}

/** What to do now: resume, start today's routine, or start something else. */
function TodayBar({
  active,
  todayRoutine,
  isRestDay,
  doneToday,
  volumeLabel,
  isBusy,
  startKey,
  isResuming,
  onResume,
  onDiscard,
  onStart,
  onLogPast,
}: TodayBarProps) {
  const elapsed = useElapsed(active && !active.isPastLog ? active.startedAt : null);

  if (active) {
    return (
      <Surface as="section" aria-label="Workout in progress" className="flex items-center gap-3 border-s-[3px] border-s-accent">
        <div className="min-w-0 flex-1">
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
          <h2 className="truncate text-[15px] font-semibold text-ink">{active.name}</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            <span className="font-mono tabular-nums">
              {active.totals.completedSets} / {active.totals.totalSets}
            </span>{" "}
            sets
          </p>
        </div>
        <Button size="sm" startContent={<Play className="h-3.5 w-3.5" />} isLoading={isResuming} onClick={onResume}>
          Resume
        </Button>
        <Popover
          role="menu"
          label="Workout options"
          align="end"
          className="w-56"
          triggerLabel="Workout options"
          triggerClassName="-me-2 grid h-11 w-9 shrink-0 place-items-center rounded-control text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
          trigger={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
        >
          {({ close }) => (
            <MenuItem
              tone="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={() => {
                close();
                onDiscard();
              }}
            >
              Discard workout
            </MenuItem>
          )}
        </Popover>
      </Surface>
    );
  }

  const done = doneToday[0] ?? null;
  let heading: React.ReactNode;
  let primary: React.ReactNode = null;

  if (done) {
    const volume = volumeLabel(done);
    heading = (
      <>
        <p className="mb-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          Done today
        </p>
        <h2 className="truncate text-[15px] font-semibold text-ink">{done.name}</h2>
        <p className="mt-0.5 truncate text-xs text-ink-3">
          {formatDurationShort(done.durationSec)} · {pluralize(done.totals.completedSets, "set")}
          {volume ? ` · ${volume}` : ""}
          {done.totals.prCount > 0 && <span className="text-warn"> · {pluralize(done.totals.prCount, "new record")}</span>}
        </p>
      </>
    );
    primary = (
      <Link href={`/workouts/history/${done.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
        View
      </Link>
    );
  } else if (todayRoutine) {
    heading = (
      <>
        <p className="mb-0.5 text-xs font-medium text-ink-3">Planned for today</p>
        <h2 className="truncate text-[15px] font-semibold text-ink">{todayRoutine.name}</h2>
        <p className="mt-0.5 text-xs text-ink-3">{pluralize(todayRoutine.exerciseCount, "exercise")}</p>
      </>
    );
    primary =
      todayRoutine.exerciseCount > 0 ? (
        <Button
          size="sm"
          startContent={<Play className="h-3.5 w-3.5" />}
          isLoading={startKey === "today"}
          disabled={isBusy}
          onClick={() => onStart({ routineId: todayRoutine.id }, "today")}
        >
          Start workout
        </Button>
      ) : (
        <Link href={`/workouts/routines/${todayRoutine.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Add exercises
        </Link>
      );
  } else if (isRestDay) {
    heading = (
      <>
        <h2 className="text-[15px] font-semibold text-ink">Rest day</h2>
        <p className="mt-0.5 text-xs text-ink-3">Recovery is part of training. You can still start a workout.</p>
      </>
    );
  } else {
    heading = (
      <>
        <h2 className="text-[15px] font-semibold text-ink">Nothing planned today</h2>
        <p className="mt-0.5 text-xs text-ink-3">Start a routine below, or an empty workout and add exercises as you go.</p>
      </>
    );
  }

  return (
    <Surface as="section" aria-label="Today" padded={false}>
      <div className="flex items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1">{heading}</div>
        {primary}
      </div>
      <div className="grid grid-cols-2 border-t border-line">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => onStart({}, "empty")}
          className="flex min-h-11 items-center justify-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-elevated/60 hover:text-ink disabled:opacity-50 cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {startKey === "empty" ? "Starting…" : "Empty workout"}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onLogPast}
          className="flex min-h-11 items-center justify-center gap-1.5 border-s border-line text-[13px] font-medium text-ink-2 transition-colors hover:bg-elevated/60 hover:text-ink disabled:opacity-50 cursor-pointer"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {startKey === "past" ? "Opening…" : "Log a past workout"}
        </button>
      </div>
    </Surface>
  );
}

interface WeekPlanProps {
  days: WeeklyScheduleDayDTO[];
  weekDates: string[];
  todayKey: WeekdayKey;
  doneDates: ReadonlySet<string>;
  hasActive: boolean;
  onEdit: (day: WeekdayKey) => void;
}

/** The week as seven cells: routine or rest, a bar when trained; tap a day to change it. */
function WeekPlan({ days, weekDates, todayKey, doneDates, hasActive, onEdit }: WeekPlanProps) {
  return (
    <Surface as="section" aria-labelledby="week-title" className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="week-title" className="text-[13px] font-semibold text-ink-2">
          Week plan
        </h2>
        <span className="text-xs font-medium text-ink-3">Tap a day to assign</span>
      </div>
      <ol className="mt-2.5 grid grid-cols-7 gap-[5px]">
        {days.map((day, index) => {
          const key = day.dayOfWeek as WeekdayKey;
          const date = weekDates[index];
          const isToday = key === todayKey;
          const trained = date ? doneDates.has(date) : false;
          const isOpen = !day.routineId && !day.isRestDay;
          const name = WEEKDAY_LABELS[key];
          const status = day.routineName ?? (day.isRestDay ? "Rest day" : "Not planned");
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onEdit(key)}
                aria-haspopup="dialog"
                aria-label={`${name}${isToday ? ", today" : ""}: ${status}${trained ? ", trained" : ""}. Change`}
                title={date ? `${formatDateString(date, { weekday: "long", month: "short", day: "numeric" })} · ${status}` : status}
                className={cn(
                  "flex min-h-[62px] w-full flex-col items-center justify-between gap-1 rounded-chip border px-0.5 py-[7px] transition-colors cursor-pointer",
                  isToday
                    ? "border-accent bg-accent-soft"
                    : isOpen
                      ? "border-dashed border-line-strong bg-transparent hover:bg-elevated/60"
                      : "border-line bg-elevated hover:border-line-strong"
                )}
              >
                <span aria-hidden="true" className={cn("text-xs", isToday ? "font-semibold text-accent" : "text-ink-3")}>
                  {name.slice(0, 1)}
                </span>
                <span aria-hidden="true" className="flex h-4 w-full items-center justify-center px-0.5">
                  {day.routineName ? (
                    <span className="truncate text-xs font-semibold text-ink">{routineTag(day.routineName)}</span>
                  ) : day.isRestDay ? (
                    <span className="text-xs text-ink-3">Rest</span>
                  ) : (
                    <Plus className="h-3 w-3 text-ink-3" />
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-[3px] w-3 rounded-[2px]",
                    trained ? "bg-ink" : isToday && hasActive ? "bg-accent" : isOpen ? "bg-transparent" : "bg-line-strong"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </Surface>
  );
}

interface RoutineRowProps {
  routine: RoutineSummaryDTO;
  isActive: boolean;
  lastDone: string | null;
  isStarting: boolean;
  disabled: boolean;
  onStart: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** One routine: the text opens the editor; Start and a menu on the right. */
function RoutineRow({ routine, isActive, lastDone, isStarting, disabled, onStart, onDuplicate, onDelete }: RoutineRowProps) {
  const href = `/workouts/routines/${routine.id}`;
  return (
    <li className="flex items-center gap-1 pe-1.5">
      <Link
        href={href}
        className="min-w-0 flex-1 self-stretch px-3.5 py-3 transition-colors hover:bg-elevated/60 active:bg-elevated"
      >
        <span className="block truncate text-[15px] font-semibold text-ink">{routine.name}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-3">
          <span className="font-mono tabular-nums">{routine.exerciseCount}</span>{" "}
          {routine.exerciseCount === 1 ? "exercise" : "exercises"} ·{" "}
          {isActive ? (
            <span className="text-accent">In progress</span>
          ) : lastDone ? (
            `Last done ${lastDone.toLowerCase()}`
          ) : (
            "Not done yet"
          )}
        </span>
      </Link>
      {routine.exerciseCount === 0 ? (
        <Link href={href} className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "ms-2")}>
          Add exercises
        </Link>
      ) : (
        <Button variant="secondary" size="sm" className="ms-2" isLoading={isStarting} disabled={disabled} onClick={onStart}>
          Start
        </Button>
      )}
      <Popover
        role="menu"
        label={`${routine.name} options`}
        align="end"
        className="w-52"
        triggerLabel={`More options for ${routine.name}`}
        triggerClassName="grid h-11 w-9 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-elevated hover:text-ink"
        trigger={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
      >
        {({ close }) => (
          <>
            <MenuItem icon={<Pencil className="h-4 w-4" />} href={href} onSelect={close}>
              Edit
            </MenuItem>
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onSelect={() => {
                close();
                onDuplicate();
              }}
            >
              Duplicate
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={() => {
                close();
                onDelete();
              }}
            >
              Delete
            </MenuItem>
          </>
        )}
      </Popover>
    </li>
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
        "flex min-h-12 w-full items-center gap-3 rounded-control px-3 py-2 text-start transition-colors cursor-pointer",
        selected ? "bg-elevated" : "hover:bg-elevated/60"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-ink bg-ink text-ink-inverse" : "border-line-strong"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{label}</span>
        {detail && <span className="block text-xs text-ink-3">{detail}</span>}
      </span>
    </button>
  );
}

export default TrainHub;
