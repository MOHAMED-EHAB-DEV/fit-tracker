"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CloudOff,
  Loader2,
  Plus,
  Repeat,
  Trash2,
  Trophy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumberField } from "@/components/ui/NumberField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ExerciseCard } from "@/components/workout/session/ExerciseCard";
import { RestTimerBar, type RestState } from "@/components/workout/session/RestTimerBar";
import { useSessionSync } from "@/components/workout/session/useSessionSync";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { useUser } from "@/context/UserContext";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { cn } from "@/lib/utils";
import { formatVolume } from "@/lib/fitness/units";
import { computeTotals, formatDuration, formatDurationShort, formatRestTime, restChoicesWith } from "@/lib/workouts/calc";
import { PR_KIND_LABELS, describeSet, toDateTimeLocalValue } from "@/lib/workouts/format";
import {
  clearDraft,
  completeSet,
  emptySet,
  exerciseFromCatalog,
  loadDraft,
  pickStartingState,
  sessionReducer,
  suggestedValues,
  tickValuedSets,
  toSessionInput,
  type SessionAction,
} from "@/lib/workouts/session-state";
import { SET_TYPES, SET_TYPE_LABELS } from "@/lib/workouts/taxonomy";
import type {
  ExerciseDTO,
  PreviousPerformanceDTO,
  PrKind,
  SessionDTO,
  SessionExerciseDTO,
} from "@/lib/workouts/types";

interface SessionScreenProps {
  initialSession: SessionDTO;
  initialPrevious: PreviousPerformanceDTO[];
}

interface FinishedRecord {
  exerciseName: string;
  kinds: PrKind[];
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  unit: "kg" | "lbs";
}

const RPE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const PR_LABELS = PR_KIND_LABELS;

/** A rest period of `restSec` seconds that starts now. */
function restStartingNow(restSec: number): RestState {
  return { endsAt: Date.now() + restSec * 1000, totalSec: restSec };
}

function restKey(sessionId: string): string {
  return `ft:rest:${sessionId}`;
}

/** Keeps the screen on while the workout is open (where the browser allows it). */
function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Battery saver or an unsupported browser: the workout still works.
      }
    };

    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

export function SessionScreen({ initialSession, initialPrevious }: SessionScreenProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, weightUnit } = useUser();
  const timezone = user?.preferences?.timezone || "Africa/Cairo";
  const defaultRestSec = user?.preferences?.restTimerDefaultSec ?? 90;

  const isEditingHistory = initialSession.status === "completed";
  /** A workout typed in afterwards: no clock, no rest timer, asks for date and duration. */
  const isPastWorkout = !isEditingHistory && initialSession.isPastLog;
  const isLive = !isEditingHistory && !isPastWorkout;

  // Unsent changes from an earlier visit on this device win over the server copy.
  const [starting] = useState(() => {
    const picked =
      typeof window === "undefined"
        ? { session: initialSession, needsSync: false }
        : pickStartingState(initialSession, loadDraft(initialSession.id));
    // A past workout needs a duration; an hour is the starting guess.
    return isPastWorkout && picked.session.durationSec == null
      ? { ...picked, session: { ...picked.session, durationSec: 3600 } }
      : picked;
  });
  const [session, rawDispatch] = useReducer(sessionReducer, starting.session);
  const sync = useSessionSync(session, rawDispatch, {
    enabled: !isEditingHistory,
    initiallyDirty: starting.needsSync,
  });

  const [previous, setPrevious] = useState<Record<string, PreviousPerformanceDTO>>(() =>
    Object.fromEntries(initialPrevious.map((item) => [item.exerciseId, item]))
  );
  const [missing, setMissing] = useState<{ setId: string; field: "weight" | "reps" | "duration" } | null>(null);
  const [rest, setRestState] = useState<RestState | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const [exerciseMenuId, setExerciseMenuId] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<{ exerciseId: string; setId: string } | null>(null);
  const [undo, setUndo] = useState<{ label: string; action: SessionAction } | null>(null);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [result, setResult] = useState<{ session: SessionDTO; records: FinishedRecord[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const editedHistory = useRef(false);

  useWakeLock(isLive && !result);

  const dispatch = useCallback(
    (action: SessionAction) => {
      rawDispatch(action);
      editedHistory.current = true;
      sync.markChanged();
    },
    [sync]
  );

  // Elapsed clock.
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Rest timer survives a reload.
  useEffect(() => {
    if (!isLive) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(restKey(initialSession.id)) || "null") as RestState | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a running timer from storage after mount
      if (stored && stored.endsAt > Date.now()) setRestState(stored);
    } catch {
      // No stored timer.
    }
  }, [isLive, initialSession.id]);

  const setRest = useCallback(
    (next: RestState | null) => {
      setRestState(next);
      try {
        if (next) window.localStorage.setItem(restKey(initialSession.id), JSON.stringify(next));
        else window.localStorage.removeItem(restKey(initialSession.id));
      } catch {
        // Storage unavailable: the timer still runs in memory.
      }
    },
    [initialSession.id]
  );

  // Clear the "needs a value" highlight after a moment.
  useEffect(() => {
    if (!missing) return;
    const timeout = setTimeout(() => setMissing(null), 2500);
    return () => clearTimeout(timeout);
  }, [missing]);

  // The undo bar disappears on its own.
  useEffect(() => {
    if (!undo) return;
    const timeout = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(timeout);
  }, [undo]);

  // Warn before closing the tab with unsent or unsaved changes.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const unsaved = isEditingHistory ? editedHistory.current : sync.hasUnsavedChanges();
      if (unsaved && !result) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isEditingHistory, sync, result]);

  // Outside a live workout, a set with its boxes filled counts as done without the tick.
  const prepared = useMemo(() => (isLive ? session : tickValuedSets(session)), [isLive, session]);
  const totals = useMemo(() => computeTotals(prepared.exercises), [prepared.exercises]);
  const pastMinutes = session.durationSec ? Math.round(session.durationSec / 60) : null;
  const endedElsewhere = sync.status === "finished_elsewhere";
  const elapsedSec = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));

  const exerciseById = (exerciseId: string) => session.exercises.find((exercise) => exercise.id === exerciseId);

  const toggleSet = (exercise: SessionExerciseDTO, setId: string) => {
    const index = exercise.sets.findIndex((item) => item.id === setId);
    const set = exercise.sets[index];
    if (!set) return;

    if (set.done) {
      dispatch({ type: "set/update", exerciseId: exercise.id, setId, patch: { done: false, doneAt: null } });
      return;
    }

    const outcome = completeSet(set, exercise.trackingType, suggestedValues(exercise, index, previous[exercise.exerciseId]));
    if (outcome.missing) {
      setMissing({ setId, field: outcome.missing });
      toast(
        outcome.missing === "weight"
          ? "Enter the weight first."
          : outcome.missing === "reps"
            ? "Enter the reps first."
            : "Enter the time first.",
        "warning"
      );
      return;
    }
    dispatch({ type: "set/replace", exerciseId: exercise.id, set: outcome.set });

    if (isLive) {
      const restSec = exercise.restSec ?? defaultRestSec;
      const isLastSet =
        exercise.sets.every((item) => item.id === setId || item.done) &&
        session.exercises[session.exercises.length - 1]?.id === exercise.id;
      if (restSec > 0 && !isLastSet) setRest(restStartingNow(restSec));
    }
  };

  const addSet = (exercise: SessionExerciseDTO) => {
    const last = exercise.sets[exercise.sets.length - 1];
    dispatch({
      type: "set/add",
      exerciseId: exercise.id,
      set: emptySet(last?.type === "warmup" ? "working" : last?.type || "working", {
        targetWeightKg: last?.weightKg ?? last?.targetWeightKg ?? null,
        targetRepMin: last?.reps ?? last?.targetRepMin ?? null,
        targetRepMax: last?.reps ?? last?.targetRepMax ?? null,
        targetDurationSec: last?.durationSec ?? last?.targetDurationSec ?? null,
      }),
    });
  };

  const removeSet = (exercise: SessionExerciseDTO, setId: string) => {
    const index = exercise.sets.findIndex((item) => item.id === setId);
    const set = exercise.sets[index];
    if (!set) return;
    dispatch({ type: "set/remove", exerciseId: exercise.id, setId });
    setUndo({ label: "Set removed", action: { type: "set/restore", exerciseId: exercise.id, set, index } });
  };

  const removeExercise = (exercise: SessionExerciseDTO) => {
    const index = session.exercises.findIndex((item) => item.id === exercise.id);
    dispatch({ type: "exercise/remove", exerciseId: exercise.id });
    setUndo({ label: `${exercise.name} removed`, action: { type: "exercise/restore", exercise, index } });
  };

  const fetchPrevious = async (exerciseIds: string[]): Promise<Record<string, PreviousPerformanceDTO>> => {
    try {
      const data = await api<{ previous: PreviousPerformanceDTO[] }>(
        `/api/sessions/previous?exerciseIds=${exerciseIds.join(",")}&excludeSessionId=${session.id}`
      );
      const map = Object.fromEntries(data.previous.map((item) => [item.exerciseId, item]));
      setPrevious((current) => ({ ...current, ...map }));
      return map;
    } catch {
      // Offline: the exercise is still added, just without last time's numbers.
      return {};
    }
  };

  const addExercises = async (picked: ExerciseDTO[]) => {
    const replaced = replaceTarget ? session.exercises.find((item) => item.id === replaceTarget) : undefined;
    const found = await fetchPrevious(picked.map((exercise) => exercise.id));
    const built = picked.map((exercise) =>
      exerciseFromCatalog(exercise, weightUnit, found[exercise.id] || previous[exercise.id], defaultRestSec)
    );
    if (replaceTarget) {
      dispatch({ type: "exercise/replace", exerciseId: replaceTarget, replacement: built[0] });
      setReplaceTarget(null);
      // The old exercise's sets, note and settings go with it; keep a way back.
      if (replaced && built[0]) {
        setUndo({
          label: `${replaced.name} replaced`,
          action: { type: "exercise/replace", exerciseId: built[0].id, replacement: replaced },
        });
      }
    } else {
      dispatch({ type: "exercise/add", exercises: built });
    }
  };

  const goBack = () => {
    if (isEditingHistory && editedHistory.current) {
      setIsLeaveOpen(true);
      return;
    }
    router.push(isEditingHistory ? `/workouts/history/${session.id}` : "/workouts");
  };

  const finish = async () => {
    if (isWorking) return;
    setIsWorking(true);
    setDialogError(null);
    // No autosave may land after the finish request.
    await sync.pause();
    try {
      const body: Record<string, unknown> = {
        version: session.version,
        name: session.name.trim() || "Workout",
        notes: session.notes,
        exercises: toSessionInput(prepared),
      };
      if (isPastWorkout) {
        body.startedAt = session.startedAt;
        body.durationSec = Math.max(60, session.durationSec || 3600);
      }
      const data = await api<{ session: SessionDTO; records: FinishedRecord[] }>(`/api/sessions/${session.id}/finish`, {
        method: "POST",
        body,
      });
      clearDraft(session.id);
      setRest(null);
      markDashboardStale();
      setResult(data);
    } catch (err) {
      sync.resume();
      setDialogError(
        err instanceof ApiError && err.offline
          ? "No connection. Your workout is saved on this device. Try again when you are back online."
          : errorMessage(err)
      );
    } finally {
      setIsWorking(false);
    }
  };

  const saveHistoryEdit = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await api(`/api/sessions/${session.id}`, {
        method: "PATCH",
        body: {
          version: session.version,
          name: session.name.trim() || "Workout",
          notes: session.notes,
          startedAt: session.startedAt,
          durationSec: Math.max(60, session.durationSec || 60),
          exercises: toSessionInput(prepared),
        },
      });
      editedHistory.current = false;
      markDashboardStale();
      toast("Workout updated", "success");
      router.push(`/workouts/history/${session.id}`);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
      setIsWorking(false);
    }
  };

  const discard = async () => {
    setIsWorking(true);
    setDialogError(null);
    await sync.pause();
    try {
      await api(`/api/sessions/${session.id}`, { method: "DELETE" });
      clearDraft(session.id);
      setRest(null);
      markDashboardStale();
      router.push("/workouts");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Already gone (discarded elsewhere): the result the user wanted.
        clearDraft(session.id);
        router.push("/workouts");
        router.refresh();
        return;
      }
      sync.resume();
      setDialogError(errorMessage(err));
      setIsWorking(false);
    }
  };

  const applyToRoutine = async () => {
    if (!result?.session.routineId) return;
    setIsWorking(true);
    try {
      await api(`/api/routines/${result.session.routineId}/apply-session`, {
        method: "POST",
        body: { sessionId: result.session.id },
      });
      toast("Routine updated with today's numbers", "success");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setIsWorking(false);
    }
  };

  const menuExercise = exerciseMenuId ? exerciseById(exerciseMenuId) : undefined;
  const menuSetExercise = setMenu ? exerciseById(setMenu.exerciseId) : undefined;
  const menuSet = menuSetExercise?.sets.find((item) => item.id === setMenu?.setId);
  const unfinishedSets = totals.totalSets - totals.completedSets;

  const statusChip = isEditingHistory ? null : sync.status === "saved" ? (
    <span className="flex items-center gap-1 text-xs text-zinc-400">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Saved
    </span>
  ) : sync.status === "saving" ? (
    <span className="flex items-center gap-1 text-xs text-zinc-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Saving
    </span>
  ) : endedElsewhere ? null : sync.status === "offline" ? (
    <span className="flex items-center gap-1 text-xs text-amber-300">
      <CloudOff className="w-3.5 h-3.5" aria-hidden="true" /> Offline · saved on this device
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-red-300">
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Not saved
    </span>
  );

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 bg-app/95 backdrop-blur-sm border-b border-line">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label={isEditingHistory ? "Back to workout" : "Back to Train (your workout keeps running)"}
            className="grid place-items-center w-11 h-11 -ms-2 rounded-full text-zinc-300 active:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={session.name}
              onChange={(event) => dispatch({ type: "meta", patch: { name: event.target.value.slice(0, 80) } })}
              aria-label="Workout name"
              className="w-full bg-transparent text-lg font-bold text-white truncate rounded-md px-1 -mx-1 transition-colors hover:bg-white/5 focus:outline-none focus:bg-white/5"
            />
            <div className="flex items-center gap-3 px-0.5">
              {isLive && (
                // Not a live region: it changes every second. The server and the browser read the clock a moment apart.
                <span className="text-sm font-semibold text-emerald-300 tabular-nums" suppressHydrationWarning>
                  <span className="sr-only">Elapsed time </span>
                  {formatDuration(elapsedSec)}
                </span>
              )}
              <span aria-live="polite">{statusChip}</span>
            </div>
          </div>
          {isEditingHistory ? (
            <Button onClick={saveHistoryEdit} isLoading={isWorking}>
              Save
            </Button>
          ) : (
            <Button
              disabled={endedElsewhere}
              onClick={() => {
                setDialogError(null);
                setIsFinishOpen(true);
              }}
            >
              Finish
            </Button>
          )}
        </div>
        {sync.status === "error" && sync.errorText && (
          <p role="alert" className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {sync.errorText}
          </p>
        )}
        {endedElsewhere && (
          <div role="alert" className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <p>{sync.errorText} Changes made here are no longer saved.</p>
            <Link href="/workouts" className="mt-1 inline-flex min-h-11 items-center font-semibold text-white underline">
              Back to Train
            </Link>
          </div>
        )}
      </header>

      {/* Date and duration for past / edited workouts */}
      {!isLive && (
        <section className="mt-4 grid grid-cols-1 gap-3 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-2">
          <Input
            label="Started"
            type="datetime-local"
            value={toDateTimeLocalValue(session.startedAt)}
            max={toDateTimeLocalValue(new Date())}
            onChange={(event) => {
              const parsed = new Date(event.target.value);
              if (!Number.isNaN(parsed.getTime())) {
                dispatch({ type: "meta", patch: { startedAt: parsed.toISOString() } });
              }
            }}
          />
          <div className="space-y-1.5">
            <span className="block text-sm text-zinc-300">Duration</span>
            <NumberField
              label="Duration in minutes"
              value={pastMinutes}
              onChange={(value) => dispatch({ type: "meta", patch: { durationSec: value == null ? null : Math.round(value * 60) } })}
              min={1}
              max={600}
              suffix="min"
            />
          </div>
        </section>
      )}

      {/* Exercises */}
      <div className="mt-4 space-y-3 pb-40">
        {session.exercises.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-base font-semibold text-white">No exercises yet</p>
            <p className="mt-1 text-sm text-zinc-400">Add the first exercise to start logging.</p>
          </div>
        ) : (
          session.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              position={index + 1}
              previous={previous[exercise.exerciseId]}
              showPrevious={!isEditingHistory}
              timezone={timezone}
              missing={missing}
              onUpdateSet={(setId, patch) => dispatch({ type: "set/update", exerciseId: exercise.id, setId, patch })}
              onToggleSet={(setId) => toggleSet(exercise, setId)}
              onOpenSetOptions={(setId) => setSetMenu({ exerciseId: exercise.id, setId })}
              onAddSet={() => addSet(exercise)}
              onOpenOptions={() => setExerciseMenuId(exercise.id)}
              onOpenDetail={() => setDetailExerciseId(exercise.exerciseId)}
            />
          ))
        )}

        <Button
          variant="flat"
          size="lg"
          className="w-full"
          startContent={<Plus className="w-5 h-5" />}
          onClick={() => {
            setReplaceTarget(null);
            setIsPickerOpen(true);
          }}
        >
          Add exercises
        </Button>

        {!isEditingHistory && (
          <button
            type="button"
            onClick={() => {
              setDialogError(null);
              setIsDiscardOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 min-h-11 text-sm font-medium text-red-300 rounded-xl active:bg-red-500/10 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Discard workout
          </button>
        )}
      </div>

      {/* Undo */}
      {undo && (
        <div className="fixed inset-x-0 bottom-above-nav z-30 px-3 pointer-events-none">
          <div
            role="status"
            className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-zinc-800 px-4 py-2 shadow-xl shadow-black/50"
          >
            <span className="flex-1 text-sm text-white truncate">{undo.label}</span>
            <button
              type="button"
              onClick={() => {
                dispatch(undo.action);
                setUndo(null);
              }}
              className="min-h-11 px-3 text-sm font-semibold text-emerald-300 rounded-lg cursor-pointer"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {isLive && !undo && <RestTimerBar rest={rest} onChange={setRest} />}

      {/* Add / replace exercise */}
      <ExercisePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        mode={replaceTarget ? "single" : "multi"}
        title={replaceTarget ? "Replace exercise" : undefined}
        onAdd={(picked) => void addExercises(picked)}
      />

      <ExerciseDetailSheet exerciseId={detailExerciseId} onClose={() => setDetailExerciseId(null)} />

      {/* Set options */}
      <Drawer
        isOpen={Boolean(setMenu && menuSet && menuSetExercise)}
        onClose={() => setSetMenu(null)}
        title="Set options"
        position="bottom"
      >
        {menuSet && menuSetExercise && (
          <div className="space-y-5">
            <div role="group" aria-label="Set type" className="grid grid-cols-2 gap-2">
              {SET_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={menuSet.type === type}
                  onClick={() =>
                    dispatch({ type: "set/update", exerciseId: menuSetExercise.id, setId: menuSet.id, patch: { type } })
                  }
                  className={cn(
                    "min-h-12 rounded-xl border text-sm font-semibold cursor-pointer",
                    menuSet.type === type
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                      : "border-line text-zinc-200"
                  )}
                >
                  {SET_TYPE_LABELS[type].label}
                </button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm text-zinc-300">
                How hard was it? <span className="text-zinc-400">(RPE, optional)</span>
              </p>
              <div role="group" aria-label="Effort (RPE)" className="flex flex-wrap gap-2">
                {RPE_CHOICES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={menuSet.rpe === value}
                    onClick={() =>
                      dispatch({
                        type: "set/update",
                        exerciseId: menuSetExercise.id,
                        setId: menuSet.id,
                        patch: { rpe: menuSet.rpe === value ? null : value },
                      })
                    }
                    className={cn(
                      "min-w-12 min-h-11 px-2 rounded-xl border text-sm font-semibold tabular-nums cursor-pointer",
                      menuSet.rpe === value
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-line text-zinc-200"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="bordered"
              className="w-full text-red-300 border-red-500/30"
              startContent={<Trash2 className="w-4 h-4" />}
              onClick={() => {
                removeSet(menuSetExercise, menuSet.id);
                setSetMenu(null);
              }}
            >
              Delete this set
            </Button>
          </div>
        )}
      </Drawer>

      {/* Exercise options */}
      <Drawer
        isOpen={Boolean(menuExercise)}
        onClose={() => setExerciseMenuId(null)}
        title={menuExercise?.name || "Exercise"}
        position="bottom"
      >
        {menuExercise && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="bordered"
                startContent={<ArrowUp className="w-4 h-4" />}
                disabled={session.exercises[0]?.id === menuExercise.id}
                onClick={() => dispatch({ type: "exercise/move", exerciseId: menuExercise.id, direction: -1 })}
              >
                Move up
              </Button>
              <Button
                variant="bordered"
                startContent={<ArrowDown className="w-4 h-4" />}
                disabled={session.exercises[session.exercises.length - 1]?.id === menuExercise.id}
                onClick={() => dispatch({ type: "exercise/move", exerciseId: menuExercise.id, direction: 1 })}
              >
                Move down
              </Button>
            </div>

            {(menuExercise.trackingType === "weight_reps" || menuExercise.trackingType === "bodyweight_reps") && (
              <div>
                <p className="mb-2 text-sm text-zinc-300">Weight unit for this exercise</p>
                <div role="group" aria-label="Weight unit" className="grid grid-cols-2 gap-2">
                  {(["kg", "lbs"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      aria-pressed={menuExercise.unit === unit}
                      onClick={() => dispatch({ type: "exercise/update", exerciseId: menuExercise.id, patch: { unit } })}
                      className={cn(
                        "min-h-12 rounded-xl border text-sm font-semibold cursor-pointer",
                        menuExercise.unit === unit
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                          : "border-line text-zinc-200"
                      )}
                    >
                      {unit === "kg" ? "Kilograms (kg)" : "Pounds (lbs)"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">Your numbers are converted, not changed.</p>
              </div>
            )}

            {isLive && (
              <Select<number>
                label="Rest after each set"
                options={restChoicesWith(menuExercise.restSec ?? defaultRestSec).map((seconds) => ({
                  value: seconds,
                  label: formatRestTime(seconds),
                }))}
                value={menuExercise.restSec ?? defaultRestSec}
                onChange={(restSec) =>
                  dispatch({
                    type: "exercise/update",
                    exerciseId: menuExercise.id,
                    patch: { restSec },
                  })
                }
              />
            )}

            <Textarea
              label="Note"
              value={menuExercise.notes}
              onChange={(event) =>
                dispatch({
                  type: "exercise/update",
                  exerciseId: menuExercise.id,
                  patch: { notes: event.target.value.slice(0, 500) },
                })
              }
              rows={2}
              placeholder="Seat height, grip, how it felt…"
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="bordered"
                startContent={<Repeat className="w-4 h-4" />}
                onClick={() => {
                  setReplaceTarget(menuExercise.id);
                  setExerciseMenuId(null);
                  setIsPickerOpen(true);
                }}
              >
                Replace
              </Button>
              <Button
                variant="bordered"
                className="text-red-300 border-red-500/30"
                startContent={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  removeExercise(menuExercise);
                  setExerciseMenuId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Finish */}
      <Modal
        isOpen={isFinishOpen}
        onClose={() => {
          if (isWorking) return;
          if (result) {
            router.push("/workouts");
            router.refresh();
            return;
          }
          setIsFinishOpen(false);
        }}
        title={result ? "Workout saved" : "Finish workout?"}
        showCloseButton={!result}
        closeOnBackdropClick={!isWorking && !result}
        footer={
          result ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                router.push("/workouts");
                router.refresh();
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="bordered" onClick={() => setIsFinishOpen(false)} disabled={isWorking}>
                Keep going
              </Button>
              <Button onClick={finish} isLoading={isWorking} disabled={totals.completedSets === 0}>
                Finish
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Time" value={formatDurationShort(result.session.durationSec)} />
              <Stat label="Sets" value={String(result.session.totals.completedSets)} />
              <Stat label="Volume" value={formatVolume(result.session.totals.volumeKg, weightUnit)} />
              <Stat label="Active calories" value={`${result.session.totals.calories} kcal`} />
            </dl>

            {result.records.length > 0 ? (
              <section aria-label="Personal records">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <Trophy className="w-4 h-4" aria-hidden="true" />
                  {result.records.length === 1 ? "New personal record" : `${result.records.length} new personal records`}
                </h3>
                <ul className="space-y-2">
                  {result.records.map((record, index) => (
                    <li key={index} className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                      <p className="text-sm font-semibold text-white">{record.exerciseName}</p>
                      <p className="text-sm text-amber-200 tabular-nums">
                        {describeSet({ ...record, distanceM: null }, record.unit)} ·{" "}
                        {record.kinds.map((kind) => PR_LABELS[kind]).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="text-sm text-zinc-400">
                {result.session.exercises.some((exercise) => previous[exercise.exerciseId])
                  ? "No new records this time. Consistency is what builds them."
                  : "These are your starting numbers. Beat them next time to set a record."}
              </p>
            )}

            {result.session.routineId && (
              <div className="rounded-2xl border border-line p-3 space-y-2">
                <p className="text-sm text-zinc-300">Use today&apos;s numbers as the targets for next time?</p>
                <Button variant="flat" className="w-full" onClick={applyToRoutine} isLoading={isWorking}>
                  Update routine targets
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2">
              <Stat
                label="Time"
                value={isPastWorkout ? `${pastMinutes || 0} min` : formatDurationShort(elapsedSec)}
              />
              <Stat label="Sets logged" value={`${totals.completedSets} / ${totals.totalSets}`} />
              <Stat label="Volume" value={formatVolume(totals.volumeKg, weightUnit)} />
            </dl>
            {totals.completedSets === 0 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {isPastWorkout
                  ? "Nothing is logged yet. Fill in at least one set, or discard the log instead."
                  : "Nothing is logged yet. Tick at least one set, or discard the workout instead."}
              </p>
            ) : unfinishedSets > 0 ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {unfinishedSets} set{unfinishedSets === 1 ? " is" : "s are"} {isPastWorkout ? "empty" : "not ticked"} and will
                not be saved.
              </p>
            ) : null}
            {dialogError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {dialogError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isDiscardOpen}
        onCancel={() => setIsDiscardOpen(false)}
        onConfirm={discard}
        title="Discard this workout?"
        message="Everything logged in this workout will be deleted. Your routine and your past workouts are not affected."
        confirmLabel="Discard workout"
        cancelLabel="Keep it"
        destructive
        isWorking={isWorking}
        error={dialogError}
      />

      <ConfirmDialog
        isOpen={isLeaveOpen}
        onCancel={() => setIsLeaveOpen(false)}
        onConfirm={() => {
          editedHistory.current = false;
          router.push(`/workouts/history/${session.id}`);
        }}
        title="Leave without saving?"
        message="Your changes to this workout have not been saved."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
      />

      {!isEditingHistory && (
        <p className="sr-only">
          <Link href="/workouts">Back to Train</Link>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-base font-semibold text-white tabular-nums">{value}</dd>
    </div>
  );
}

export default SessionScreen;
