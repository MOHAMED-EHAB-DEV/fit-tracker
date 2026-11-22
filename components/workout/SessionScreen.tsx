"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ListOrdered, MoreHorizontal, NotebookPen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { NumberField } from "@/components/ui/NumberField";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ExerciseBlock } from "@/components/workout/session/ExerciseBlock";
import { ExerciseOptionsSheet } from "@/components/workout/session/ExerciseOptionsSheet";
import { FinishSheet, type FinishedRecord } from "@/components/workout/session/FinishSheet";
import { KeypadBar } from "@/components/workout/session/KeypadBar";
import { SessionDock, restStartingNow, type RestState } from "@/components/workout/session/SessionDock";
import { patchFor } from "@/components/workout/session/SetLedgerRow";
import {
  fieldDecimals,
  fieldHeader,
  fieldMax,
  fieldStep,
  fieldValue,
  formatLogValues,
  ledgerFields,
  type LedgerField,
} from "@/components/workout/session/ledger";
import { useSessionSync } from "@/components/workout/session/useSessionSync";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { announceActiveSessionChange } from "@/components/workout/ActiveSessionBar";
import { useUser } from "@/context/UserContext";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { cn } from "@/lib/utils";
import { computeTotals, formatDuration, formatDurationShort } from "@/lib/workouts/calc";
import { setOrdinals, toDateTimeLocalValue } from "@/lib/workouts/format";
import {
  activeSet,
  allSetsDone,
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
import type { ExerciseDTO, PreviousPerformanceDTO, SessionDTO, SessionExerciseDTO } from "@/lib/workouts/types";
import { useScrolled } from "@/hooks/useScrolled";

interface SessionScreenProps {
  initialSession: SessionDTO;
  initialPrevious: PreviousPerformanceDTO[];
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

/**
 * The live workout in focus mode: no tab bar, a top bar (minimise · name,
 * time, sync · menu), a progress hairline, the full-bleed set ledger and the
 * glass dock (rest timer or Undo, Finish, "Log set N · W × R"). The same
 * screen edits a finished workout and logs a past one, without the clock.
 */
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
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ exerciseId: string; setId: string; field: LedgerField } | null>(null);
  const blurTimer = useRef<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const [optionsExerciseId, setOptionsExerciseId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [undo, setUndo] = useState<{ label: string; action: SessionAction } | null>(null);
  const [isFinishOpen, setIsFinishOpen] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [result, setResult] = useState<{ session: SessionDTO; records: FinishedRecord[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const editedHistory = useRef(false);
  const scrolled = useScrolled();

  useWakeLock(isLive && !result);

  const dispatch = useCallback(
    (action: SessionAction) => {
      rawDispatch(action);
      editedHistory.current = true;
      sync.markChanged();
    },
    [sync]
  );

  // Elapsed clock. It stops once the workout is saved.
  const isSaved = Boolean(result);
  useEffect(() => {
    if (!isLive || isSaved) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive, isSaved]);

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

  // The Undo strip disappears on its own after 7 seconds.
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

  const active = isLive ? activeSet(session, focusedExerciseId) : null;
  const expandedId = focusedExerciseId ?? active?.exerciseId ?? null;
  const everythingDone = allSetsDone(session);
  const prCount = session.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.done && set.prKinds.length > 0).length,
    0
  );

  const exerciseById = (exerciseId: string) => session.exercises.find((exercise) => exercise.id === exerciseId);

  const toggleSet = (exercise: SessionExerciseDTO, setId: string): boolean => {
    const index = exercise.sets.findIndex((item) => item.id === setId);
    const set = exercise.sets[index];
    if (!set) return false;

    if (set.done) {
      dispatch({ type: "set/update", exerciseId: exercise.id, setId, patch: { done: false, doneAt: null } });
      return true;
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
      return false;
    }
    dispatch({ type: "set/replace", exerciseId: exercise.id, set: outcome.set });

    // Once this exercise is finished, the screen follows the next open set again.
    if (exercise.sets.every((item) => item.id === setId || item.done)) setFocusedExerciseId(null);

    if (isLive) {
      const restSec = exercise.restSec ?? defaultRestSec;
      const isLastSet =
        exercise.sets.every((item) => item.id === setId || item.done) &&
        session.exercises.every((other) => other.id === exercise.id || other.sets.every((item) => item.done));
      if (restSec > 0 && !isLastSet) setRest(restStartingNow(restSec));
    }
    return true;
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
    setUndo({ label: "Set deleted", action: { type: "set/restore", exerciseId: exercise.id, set, index } });
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
      if (built[0]) setFocusedExerciseId(built[0].id);
    }
  };

  const leave = () => {
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
      announceActiveSessionChange();
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
      announceActiveSessionChange();
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

  // ---- Keypad bar: steppers and Next for the box being edited ---------------

  const onFocusField = (exerciseId: string, setId: string, field: LedgerField | null) => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    if (field) {
      setEditing({ exerciseId, setId, field });
      return;
    }
    // Focus may be moving straight to the next box: wait a moment before closing the bar.
    blurTimer.current = window.setTimeout(() => setEditing(null), 80);
  };

  const editingExercise = editing ? exerciseById(editing.exerciseId) : undefined;
  const editingSetIndex = editingExercise ? editingExercise.sets.findIndex((set) => set.id === editing?.setId) : -1;
  const editingSet = editingExercise && editingSetIndex >= 0 ? editingExercise.sets[editingSetIndex] : undefined;
  const editingFields = editingExercise
    ? ledgerFields(
        editingExercise.trackingType,
        editingExercise.sets.some((set) => set.weightKg != null && set.weightKg > 0)
      )
    : [];

  const stepEditing = (delta: number) => {
    if (!editing || !editingExercise || !editingSet) return;
    const { field } = editing;
    const suggestion = suggestedValues(editingExercise, editingSetIndex, previous[editingExercise.exerciseId]);
    const current =
      fieldValue(editingSet, field, editingExercise.unit, editingExercise.trackingType) ??
      fieldValue(suggestion, field, editingExercise.unit, editingExercise.trackingType) ??
      0;
    const decimals = fieldDecimals(field, editingExercise.trackingType);
    const max = fieldMax(field, editingExercise.unit, editingExercise.trackingType);
    const next = Math.min(max, Math.max(0, Math.round((current + delta) * 10 ** decimals) / 10 ** decimals));
    dispatch({
      type: "set/update",
      exerciseId: editingExercise.id,
      setId: editingSet.id,
      patch: patchFor(field, next, editingExercise.unit, editingExercise.trackingType),
    });
  };

  /** Enter / Next: weight → reps → log the set. */
  const advance = (exerciseId: string, setId: string, field: LedgerField, fields: LedgerField[]) => {
    const position = fields.indexOf(field);
    const nextField = fields[position + 1];
    if (nextField) {
      document.getElementById(`set-${setId}-${nextField}`)?.focus();
      return;
    }
    const exercise = exerciseById(exerciseId);
    const set = exercise?.sets.find((item) => item.id === setId);
    if (!exercise || !set) return;
    if (!isLive || set.done || toggleSet(exercise, setId)) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };

  // ---- Dock --------------------------------------------------------------

  const activeExercise = active ? exerciseById(active.exerciseId) : undefined;
  const activeSetDto = activeExercise?.sets[active?.setIndex ?? -1];
  let primaryLabel: React.ReactNode = "Finish workout";
  let primaryAria: string | undefined;
  let onPrimary = () => {
    setDialogError(null);
    setIsFinishOpen(true);
  };
  if (isEditingHistory) {
    primaryLabel = "Save changes";
    onPrimary = () => void saveHistoryEdit();
  } else if (isPastWorkout) {
    primaryLabel = "Save workout";
  } else if (session.exercises.length === 0) {
    primaryLabel = (
      <>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add exercise
      </>
    );
    onPrimary = () => {
      setReplaceTarget(null);
      setIsPickerOpen(true);
    };
  } else if (!everythingDone && activeExercise && activeSetDto && active) {
    const ordinal = setOrdinals(activeExercise.sets)[active.setIndex];
    const typeLabel = activeSetDto.type === "warmup" ? "warm-up" : "set";
    const values = completeSet(
      activeSetDto,
      activeExercise.trackingType,
      suggestedValues(activeExercise, active.setIndex, previous[activeExercise.exerciseId])
    ).set;
    const valueText = formatLogValues(values, activeExercise.unit, activeExercise.trackingType);
    primaryLabel = (
      <>
        Log {typeLabel}{" "}
        <span className="font-mono tabular-nums">
          {ordinal}
          {valueText ? ` · ${valueText}` : ""}
        </span>
      </>
    );
    primaryAria = `Log ${typeLabel} ${ordinal} of ${activeExercise.name}${valueText ? `: ${valueText}` : ""}`;
    onPrimary = () => {
      toggleSet(activeExercise, activeSetDto.id);
    };
  }

  const syncChip = isEditingHistory ? null : sync.status === "saved" ? (
    <span className="inline-flex items-center gap-1 text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      Saved
    </span>
  ) : sync.status === "saving" ? (
    <span className="text-ink-2">Saving…</span>
  ) : endedElsewhere ? null : sync.status === "offline" ? (
    <span className="text-warn">Offline · saved here</span>
  ) : (
    <span className="text-danger">Not saved</span>
  );

  // Progress hairline: sets done of all sets, a tick at each exercise boundary.
  const allSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const doneSets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
  const boundaries: number[] = [];
  let running = 0;
  for (const exercise of session.exercises.slice(0, -1)) {
    running += exercise.sets.length;
    if (allSets > 0) boundaries.push((running / allSets) * 100);
  }

  const optionsExercise = optionsExerciseId ? exerciseById(optionsExerciseId) : undefined;

  return (
    <div style={{ paddingBottom: "calc(var(--dock-height, 120px) + 1rem)" }}>
      {/* Top bar */}
      <header
        className={cn(
          "sticky top-0 z-30 -mx-4 border-b border-transparent px-1.5 pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow] duration-200 sm:-mx-6",
          scrolled && "glass-chrome-top"
        )}
      >
        <div className="flex h-[52px] items-center justify-between gap-1">
          <IconButton
            label={isLive ? "Minimise workout (it keeps running)" : isEditingHistory ? "Back to the workout" : "Back to Train"}
            icon={isLive ? <ChevronDown className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            onClick={leave}
          />
          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="max-w-full truncate rounded-chip px-1 text-sm font-semibold text-ink hover:bg-elevated cursor-pointer"
              aria-label={`Workout name: ${session.name || "Workout"}. Change name or note`}
            >
              {session.name || "Workout"}
            </button>
            <div className="flex items-center gap-2 text-xs text-ink-2" aria-live="polite">
              {isLive && (
                // Not a live region: it changes every second. The server and the browser read the clock a moment apart.
                <span className="font-mono tabular-nums" aria-live="off" suppressHydrationWarning>
                  <span className="sr-only">Elapsed time </span>
                  {formatDuration(elapsedSec)}
                </span>
              )}
              {isPastWorkout && <span>Past workout</span>}
              {isEditingHistory && <span>Editing a finished workout</span>}
              {syncChip}
            </div>
          </div>
          <Popover
            role="menu"
            label="Workout options"
            align="end"
            className="w-60"
            triggerLabel="Workout options"
            triggerClassName="relative grid h-10 w-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-elevated hover:text-ink before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            trigger={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
          >
            {({ close }) => (
              <>
                <MenuItem
                  icon={<NotebookPen className="h-[18px] w-[18px]" />}
                  onSelect={() => {
                    close();
                    setIsDetailsOpen(true);
                  }}
                >
                  Name and note
                </MenuItem>
                <MenuItem
                  icon={<ListOrdered className="h-[18px] w-[18px]" />}
                  disabled={session.exercises.length < 2}
                  onSelect={() => {
                    close();
                    setIsReordering(true);
                  }}
                >
                  Reorder exercises
                </MenuItem>
                <MenuItem
                  icon={<Plus className="h-[18px] w-[18px]" />}
                  onSelect={() => {
                    close();
                    setReplaceTarget(null);
                    setIsPickerOpen(true);
                  }}
                >
                  Add exercise
                </MenuItem>
                {!isEditingHistory && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={<Trash2 className="h-[18px] w-[18px]" />}
                      tone="danger"
                      onSelect={() => {
                        close();
                        setDialogError(null);
                        setIsDiscardOpen(true);
                      }}
                    >
                      Discard workout
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </Popover>
        </div>
      </header>

      {/* Progress hairline */}
      {isLive && allSets > 0 && (
        <div
          role="progressbar"
          aria-label="Sets logged"
          aria-valuemin={0}
          aria-valuemax={allSets}
          aria-valuenow={doneSets}
          className="relative -mx-4 h-[3px] border-b border-line bg-elevated sm:-mx-6"
        >
          <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${(doneSets / allSets) * 100}%` }} />
          {boundaries.map((position) => (
            <span
              key={position}
              aria-hidden="true"
              className="absolute top-0 h-full w-[1.5px] bg-canvas"
              style={{ left: `calc(${position}% - 0.75px)` }}
            />
          ))}
        </div>
      )}

      {sync.status === "error" && sync.errorText && (
        <p role="alert" className="mt-3 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {sync.errorText}
        </p>
      )}
      {endedElsewhere && (
        <div role="alert" className="mt-3 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink-2">
          <p>{sync.errorText} Changes made here are no longer saved.</p>
          <Link href="/workouts" className="mt-1 inline-flex min-h-11 items-center font-semibold text-ink underline">
            Back to Train
          </Link>
        </div>
      )}

      {/* Date and duration for past / edited workouts */}
      {!isLive && (
        <section className="mt-3 grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2">
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
            <span className="block text-[13px] font-medium text-ink-2">Duration</span>
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

      {/* Ledger (full bleed) */}
      <div className={cn("-mx-4 sm:-mx-6", !isLive && "mt-3")}>
        {isReordering ? (
          <section aria-label="Reorder exercises">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <p className="text-[13px] font-semibold text-ink-2">Reorder exercises</p>
              <Button size="sm" onClick={() => setIsReordering(false)}>
                Done
              </Button>
            </div>
            <ul>
              {session.exercises.map((exercise, index) => (
                <li key={exercise.id} className="flex h-12 items-center justify-between gap-2 border-b border-line px-3">
                  <span className="min-w-0 truncate text-sm font-medium text-ink">
                    <span className="me-2 font-mono text-xs tabular-nums text-ink-3">{index + 1}</span>
                    {exercise.name}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      size="sm"
                      variant="secondary"
                      label={`Move ${exercise.name} up`}
                      icon={<ArrowUp className="h-4 w-4" />}
                      disabled={index === 0}
                      onClick={() => dispatch({ type: "exercise/move", exerciseId: exercise.id, direction: -1 })}
                    />
                    <IconButton
                      size="sm"
                      variant="secondary"
                      label={`Move ${exercise.name} down`}
                      icon={<ArrowDown className="h-4 w-4" />}
                      disabled={index === session.exercises.length - 1}
                      onClick={() => dispatch({ type: "exercise/move", exerciseId: exercise.id, direction: 1 })}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : session.exercises.length === 0 ? (
          <div className="mx-4 mt-6 rounded-card border border-dashed border-line-strong px-4 py-10 text-center sm:mx-6">
            <p className="text-section font-semibold text-ink">No exercises yet</p>
            <p className="mt-1 text-sm text-ink-2">Add the first exercise to start logging.</p>
          </div>
        ) : (
          session.exercises.map((exercise, index) => (
            <React.Fragment key={exercise.id}>
              {index > 0 && expandedId !== null && (exercise.id === expandedId || session.exercises[index - 1].id === expandedId) && (
                <div aria-hidden="true" className="h-1.5 border-b border-line bg-recessed" />
              )}
              <ExerciseBlock
                exercise={exercise}
                previous={previous[exercise.exerciseId]}
                expanded={!isLive || exercise.id === expandedId}
                activeSetId={active?.exerciseId === exercise.id ? active.setId : null}
                showPrevious={!isEditingHistory}
                showTicks={isLive}
                timezone={timezone}
                restSec={exercise.restSec ?? defaultRestSec}
                missing={missing}
                onExpand={() => setFocusedExerciseId(exercise.id)}
                onUpdateSet={(setId, patch) => dispatch({ type: "set/update", exerciseId: exercise.id, setId, patch })}
                onToggleSet={(setId) => void toggleSet(exercise, setId)}
                onRemoveSet={(setId) => removeSet(exercise, setId)}
                onAddSet={() => addSet(exercise)}
                onOpenOptions={() => setOptionsExerciseId(exercise.id)}
                onOpenDetail={() => setDetailExerciseId(exercise.exerciseId)}
                onEnterField={(setId, field, fields) => advance(exercise.id, setId, field, fields)}
                onFocusField={(setId, field) => onFocusField(exercise.id, setId, field)}
              />
            </React.Fragment>
          ))
        )}

        {!isReordering && (
          <div className="px-3 pt-2.5">
            <button
              type="button"
              onClick={() => {
                setReplaceTarget(null);
                setIsPickerOpen(true);
              }}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition-colors hover:text-ink cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add exercise
            </button>
          </div>
        )}
      </div>

      {!result && (
        <SessionDock
          rest={isLive ? rest : null}
          onRestChange={setRest}
          undo={undo}
          onUndo={() => {
            if (!undo) return;
            dispatch(undo.action);
            setUndo(null);
          }}
          hidden={Boolean(editing)}
          secondary={
            isLive && !everythingDone && session.exercises.length > 0
              ? {
                  label: "Finish",
                  disabled: endedElsewhere,
                  onClick: () => {
                    setDialogError(null);
                    setIsFinishOpen(true);
                  },
                }
              : null
          }
          primary={{
            label: primaryLabel,
            ariaLabel: primaryAria,
            onClick: onPrimary,
            disabled: endedElsewhere,
            isLoading: isEditingHistory && isWorking,
          }}
        />
      )}

      {editing && editingExercise && editingSet && (
        <KeypadBar
          unitLabel={fieldHeader(editing.field, editingExercise.unit, editingExercise.trackingType)}
          step={fieldStep(editing.field, editingExercise.unit, editingExercise.trackingType)}
          onStep={stepEditing}
          nextLabel={
            editingFields.indexOf(editing.field) < editingFields.length - 1 ? "Next" : isLive && !editingSet.done ? "Log set" : "Done"
          }
          onNext={() => advance(editingExercise.id, editingSet.id, editing.field, editingFields)}
        />
      )}

      <ExercisePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        mode={replaceTarget ? "single" : "multi"}
        title={replaceTarget ? "Replace exercise" : undefined}
        onAdd={(picked) => void addExercises(picked)}
      />

      <ExerciseDetailSheet exerciseId={detailExerciseId} onClose={() => setDetailExerciseId(null)} />

      <ExerciseOptionsSheet
        exercise={optionsExercise}
        isFirst={session.exercises[0]?.id === optionsExerciseId}
        isLast={session.exercises[session.exercises.length - 1]?.id === optionsExerciseId}
        showRest={isLive}
        defaultRestSec={defaultRestSec}
        onClose={() => setOptionsExerciseId(null)}
        onMove={(direction) => optionsExerciseId && dispatch({ type: "exercise/move", exerciseId: optionsExerciseId, direction })}
        onUpdate={(patch) => optionsExerciseId && dispatch({ type: "exercise/update", exerciseId: optionsExerciseId, patch })}
        onReplace={() => {
          setReplaceTarget(optionsExerciseId);
          setOptionsExerciseId(null);
          setIsPickerOpen(true);
        }}
        onRemove={() => {
          if (optionsExercise) removeExercise(optionsExercise);
          setOptionsExerciseId(null);
        }}
        onOpenDetail={() => {
          if (optionsExercise) setDetailExerciseId(optionsExercise.exerciseId);
          setOptionsExerciseId(null);
        }}
      />

      <Sheet isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Name and note">
        <div className="space-y-4">
          <Input
            label="Workout name"
            value={session.name}
            onChange={(event) => dispatch({ type: "meta", patch: { name: event.target.value.slice(0, 80) } })}
            autoComplete="off"
          />
          <Textarea
            label="Workout note"
            value={session.notes}
            onChange={(event) => dispatch({ type: "meta", patch: { notes: event.target.value.slice(0, 1000) } })}
            rows={3}
            placeholder="How it went, what to change next time…"
          />
          <Button fullWidth onClick={() => setIsDetailsOpen(false)}>
            Done
          </Button>
        </div>
      </Sheet>

      <FinishSheet
        isOpen={isFinishOpen || Boolean(result)}
        onClose={() => setIsFinishOpen(false)}
        isPastLog={isPastWorkout}
        sessionName={session.name || "Workout"}
        durationLabel={isPastWorkout ? `${pastMinutes || 0} min` : formatDurationShort(elapsedSec)}
        setsDone={totals.completedSets}
        setsTotal={totals.totalSets}
        volumeKg={totals.volumeKg}
        weightUnit={weightUnit}
        prCount={prCount}
        isWorking={isWorking}
        error={dialogError}
        onConfirm={() => void finish()}
        result={result}
        hadEarlierResults={session.exercises.some((exercise) => previous[exercise.exerciseId])}
        onDone={() => {
          router.push("/workouts");
          router.refresh();
        }}
      />

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
    </div>
  );
}

export default SessionScreen;
