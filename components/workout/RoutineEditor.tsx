"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Dumbbell, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { RoutineExerciseBlock, type EditorExercise, type EditorSet } from "@/components/workout/routine/RoutineExerciseBlock";
import { ExerciseOptionsSheet } from "@/components/workout/session/ExerciseOptionsSheet";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { useScrolled } from "@/hooks/useScrolled";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import type { WeightUnit } from "@/lib/fitness/units";
import { newId } from "@/lib/workouts/session-state";
import type { TrackingType } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO, RoutineDTO, RoutineSetDTO } from "@/lib/workouts/types";

interface RoutineEditorProps {
  initialRoutine: RoutineDTO;
  /** The workout currently open, if any (starting another one asks first). */
  active: { id: string; name: string } | null;
}

interface EditorState {
  name: string;
  notes: string;
  exercises: EditorExercise[];
}

type SaveStatus = "saved" | "saving" | "error";

const SAVE_DELAY_MS = 800;

function isRepBased(trackingType: TrackingType): boolean {
  return trackingType === "weight_reps" || trackingType === "bodyweight_reps";
}

function defaultSet(trackingType: TrackingType): EditorSet {
  return {
    key: newId(),
    type: "working",
    repMin: isRepBased(trackingType) ? 8 : null,
    repMax: isRepBased(trackingType) ? 12 : null,
    targetWeightKg: null,
    targetDurationSec: trackingType === "duration" ? 30 : trackingType === "cardio" ? 600 : null,
    targetRpe: null,
  };
}

function fromCatalog(exercise: ExerciseDTO, unit: WeightUnit, restSec: number | null): EditorExercise {
  const count = exercise.trackingType === "cardio" ? 1 : 3;
  return {
    id: newId(),
    exerciseId: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    muscleGroup: exercise.muscleGroup,
    trackingType: exercise.trackingType,
    unit,
    restSec,
    notes: "",
    supersetGroup: null,
    sets: Array.from({ length: count }, () => defaultSet(exercise.trackingType)),
  };
}

function toEditorState(routine: RoutineDTO): EditorState {
  return {
    name: routine.name,
    notes: routine.notes,
    exercises: routine.exercises.map((exercise) => ({
      ...exercise,
      // Stable keys for the saved sets, so the server and the browser render the same field ids.
      sets: exercise.sets.map((set, index) => ({ ...set, key: `${exercise.id}-${index}` })),
    })),
  };
}

function toRequestBody(state: EditorState) {
  const name = state.name.trim();
  return {
    // An empty name is never sent: the last valid name stays.
    ...(name ? { name } : {}),
    notes: state.notes,
    exercises: state.exercises.map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      unit: exercise.unit,
      restSec: exercise.restSec,
      notes: exercise.notes,
      supersetGroup: exercise.supersetGroup,
      sets: exercise.sets.map((set) => {
        // "12 to 8" is read as "8 to 12".
        const low = set.repMin != null && set.repMax != null ? Math.min(set.repMin, set.repMax) : set.repMin;
        const high = set.repMin != null && set.repMax != null ? Math.max(set.repMin, set.repMax) : set.repMax;
        return {
          type: set.type,
          repMin: low,
          repMax: high,
          targetWeightKg: set.targetWeightKg,
          targetDurationSec: set.targetDurationSec,
          targetRpe: set.targetRpe,
        };
      }),
    })),
  };
}

/**
 * Builds and edits a routine with the same set ledger and set popover as the
 * live workout, in target mode (planned weight, rep range or time). Every
 * change is saved automatically.
 */
export function RoutineEditor({ initialRoutine, active }: RoutineEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, weightUnit } = useUser();
  const defaultRestSec = user?.preferences?.restTimerDefaultSec ?? 90;
  const starter = useStartWorkout(active);
  const scrolled = useScrolled();

  const [state, setState] = useState<EditorState>(() => toEditorState(initialRoutine));
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [optionsExerciseId, setOptionsExerciseId] = useState<string | null>(null);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const latest = useRef(state);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  const schedule = useCallback((delayMs: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void saveRef.current();
    }, delayMs);
  }, []);

  /** Sends pending changes. Resolves to true when everything is saved. */
  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current;
    if (savedRevision.current === revision.current) return true;

    const run = async () => {
      const sentRevision = revision.current;
      setStatus("saving");
      try {
        await api(`/api/routines/${initialRoutine.id}`, { method: "PATCH", body: toRequestBody(latest.current) });
        savedRevision.current = sentRevision;
        setSaveError(null);
        if (sentRevision === revision.current) setStatus("saved");
        else schedule(0);
      } catch (err) {
        setStatus("error");
        setSaveError(errorMessage(err, "This routine could not be saved."));
      }
    };

    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    await inFlight.current;
    return savedRevision.current === revision.current;
  }, [initialRoutine.id, schedule]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return save();
  }, [save]);

  const change = useCallback(
    (update: (current: EditorState) => EditorState) => {
      setState(update);
      revision.current += 1;
      setStatus("saving");
      schedule(SAVE_DELAY_MS);
    },
    [schedule]
  );

  // Leaving the screen sends what is pending; closing the tab warns if it cannot.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden" && savedRevision.current !== revision.current) void saveRef.current();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRevision.current !== revision.current) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
      if (savedRevision.current !== revision.current) void saveRef.current();
    };
  }, []);

  /** Removing things is instant; the toast offers the way back. */
  const offerUndo = (label: string, restore: (current: EditorState) => EditorState) => {
    toast(label, "info", { action: { label: "Undo", onClick: () => change(restore) } });
  };

  const updateExercise = (exerciseId: string, update: (exercise: EditorExercise) => EditorExercise) =>
    change((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => (exercise.id === exerciseId ? update(exercise) : exercise)),
    }));

  const updateSet = (exerciseId: string, key: string, patch: Partial<RoutineSetDTO>) =>
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => (set.key === key ? { ...set, ...patch } : set)),
    }));

  const addSet = (exercise: EditorExercise) =>
    updateExercise(exercise.id, (current) => {
      const last = current.sets[current.sets.length - 1];
      const next: EditorSet = last
        ? { ...last, key: newId(), type: last.type === "warmup" ? "working" : last.type }
        : defaultSet(current.trackingType);
      return { ...current, sets: [...current.sets, next] };
    });

  const removeSet = (exercise: EditorExercise, key: string) => {
    const index = exercise.sets.findIndex((set) => set.key === key);
    const removed = exercise.sets[index];
    if (!removed) return;
    updateExercise(exercise.id, (current) => ({ ...current, sets: current.sets.filter((set) => set.key !== key) }));
    offerUndo("Set removed", (current) => ({
      ...current,
      exercises: current.exercises.map((item) => {
        if (item.id !== exercise.id) return item;
        const sets = [...item.sets];
        sets.splice(Math.min(index, sets.length), 0, removed);
        return { ...item, sets };
      }),
    }));
  };

  const removeExercise = (exercise: EditorExercise) => {
    const index = state.exercises.findIndex((item) => item.id === exercise.id);
    change((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }));
    offerUndo(`${exercise.name} removed`, (current) => {
      const exercises = [...current.exercises];
      exercises.splice(Math.min(index, exercises.length), 0, exercise);
      return { ...current, exercises };
    });
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) =>
    change((current) => {
      const index = current.exercises.findIndex((exercise) => exercise.id === exerciseId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.exercises.length) return current;
      const exercises = [...current.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...current, exercises };
    });

  const addExercises = (picked: ExerciseDTO[]) => {
    const built = picked.map((exercise) => fromCatalog(exercise, weightUnit, defaultRestSec));
    if (replaceTarget) {
      const target = replaceTarget;
      const replaced = state.exercises.find((exercise) => exercise.id === target);
      const replacement = built[0];
      setReplaceTarget(null);
      if (!replacement) return;
      change((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) => (exercise.id === target ? replacement : exercise)),
      }));
      // The old exercise's sets, targets and note go with it; keep a way back.
      if (replaced) {
        offerUndo(`${replaced.name} replaced`, (current) => ({
          ...current,
          exercises: current.exercises.map((exercise) => (exercise.id === replacement.id ? replaced : exercise)),
        }));
      }
    } else {
      change((current) => ({ ...current, exercises: [...current.exercises, ...built] }));
    }
  };

  const leave = () => {
    router.push("/workouts");
    router.refresh();
  };

  const goBack = async () => {
    // Changes that cannot be saved are never dropped without asking.
    if (await saveNow()) leave();
    else setIsLeaveOpen(true);
  };

  const startWorkout = async () => {
    if (!(await saveNow())) {
      toast("The routine could not be saved, so the workout was not started. Check your connection.", "error");
      return;
    }
    await starter.start({ routineId: initialRoutine.id }, "start");
  };

  const deleteRoutine = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      await api(`/api/routines/${initialRoutine.id}`, { method: "DELETE" });
      // Nothing left to save.
      savedRevision.current = revision.current;
      toast("Routine deleted", "success");
      router.push("/workouts");
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err));
      setIsDeleting(false);
    }
  };

  const optionsIndex = optionsExerciseId ? state.exercises.findIndex((exercise) => exercise.id === optionsExerciseId) : -1;
  const optionsExercise = optionsIndex >= 0 ? state.exercises[optionsIndex] : undefined;
  const nameMissing = state.name.trim().length === 0;
  const setCount = state.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

  return (
    <div className="mx-auto max-w-[680px]">
      <header
        className={cn(
          "sticky top-0 z-30 -mx-4 border-b border-transparent px-1.5 pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow] duration-200 sm:-mx-6 md:mx-0 md:px-0",
          scrolled && "glass-chrome-top"
        )}
      >
        <div className="flex h-[52px] items-center gap-1">
          <IconButton label="Back to Train" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => void goBack()} />
          <div className="min-w-0 flex-1">
            <input
              value={state.name}
              onChange={(event) => {
                const name = event.target.value.slice(0, 80);
                change((current) => ({ ...current, name }));
              }}
              aria-label="Routine name"
              aria-invalid={nameMissing}
              aria-describedby="routine-status"
              placeholder="Routine name"
              className="-mx-1 w-full truncate rounded-chip bg-transparent px-1 text-[15px] font-semibold text-ink outline-none transition-colors placeholder:text-ink-3 hover:bg-elevated focus:bg-elevated"
            />
            <p id="routine-status" className="text-xs" aria-live="polite">
              {nameMissing ? (
                <span className="text-warn">A routine needs a name.</span>
              ) : status === "saved" ? (
                <span className="inline-flex items-center gap-1 text-ink-3">
                  <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" /> Saved
                </span>
              ) : status === "saving" ? (
                <span className="inline-flex items-center gap-1 text-ink-3">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Saving
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-danger">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Not saved
                </span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            className="me-1.5 md:me-0"
            startContent={<Play className="h-3.5 w-3.5" />}
            isLoading={starter.busyKey === "start" || starter.isNavigating}
            disabled={state.exercises.length === 0 || starter.isBusy}
            onClick={() => void startWorkout()}
          >
            Start
          </Button>
        </div>
      </header>

      {status === "error" && (
        <div
          role="alert"
          className="mt-2 flex items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 text-sm text-danger"
        >
          <span className="flex-1">{saveError}</span>
          <Button variant="secondary" size="sm" onClick={() => void saveNow()}>
            Try again
          </Button>
        </div>
      )}

      <div className="mt-3 space-y-3 pb-8">
        <Textarea
          label="Routine note (optional)"
          value={state.notes}
          onChange={(event) => {
            const notes = event.target.value.slice(0, 1000);
            change((current) => ({ ...current, notes }));
          }}
          rows={2}
          placeholder="Anything to remember about this routine"
        />

        {state.exercises.length > 0 && (
          <p className="px-0.5 text-xs text-ink-3">
            <span className="font-mono tabular-nums">{state.exercises.length}</span>{" "}
            {state.exercises.length === 1 ? "exercise" : "exercises"} · <span className="font-mono tabular-nums">{setCount}</span>{" "}
            {setCount === 1 ? "set" : "sets"} · Tap a set number for type, effort or delete
          </p>
        )}

        {state.exercises.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title="No exercises yet"
            description="Add the exercises you do in this routine. You can set target weights, rep ranges and rest for each."
          />
        ) : (
          state.exercises.map((exercise, index) => (
            <RoutineExerciseBlock
              key={exercise.id}
              exercise={exercise}
              position={index + 1}
              restSec={exercise.restSec ?? defaultRestSec}
              onOpenDetail={() => setDetailExerciseId(exercise.exerciseId)}
              onOpenOptions={() => setOptionsExerciseId(exercise.id)}
              onUpdateSet={(key, patch) => updateSet(exercise.id, key, patch)}
              onRemoveSet={(key) => removeSet(exercise, key)}
              onAddSet={() => addSet(exercise)}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => {
            setReplaceTarget(null);
            setIsPickerOpen(true);
          }}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong text-sm font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add exercises
        </button>

        <Button
          variant="ghost"
          fullWidth
          className="text-danger hover:text-danger"
          startContent={<Trash2 className="h-4 w-4" />}
          onClick={() => {
            setDeleteError(null);
            setIsDeleteOpen(true);
          }}
        >
          Delete routine
        </Button>
      </div>

      <ExercisePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        mode={replaceTarget ? "single" : "multi"}
        title={replaceTarget ? "Replace exercise" : undefined}
        onAdd={addExercises}
      />

      <ExerciseDetailSheet exerciseId={detailExerciseId} onClose={() => setDetailExerciseId(null)} />

      <ExerciseOptionsSheet
        exercise={optionsExercise}
        isFirst={optionsIndex === 0}
        isLast={optionsIndex === state.exercises.length - 1}
        showRest
        defaultRestSec={defaultRestSec}
        removeLabel="Remove from routine"
        onClose={() => setOptionsExerciseId(null)}
        onMove={(direction) => optionsExercise && moveExercise(optionsExercise.id, direction)}
        onUpdate={(patch) => optionsExercise && updateExercise(optionsExercise.id, (exercise) => ({ ...exercise, ...patch }))}
        onReplace={() => {
          if (!optionsExercise) return;
          setReplaceTarget(optionsExercise.id);
          setOptionsExerciseId(null);
          setIsPickerOpen(true);
        }}
        onRemove={() => {
          if (!optionsExercise) return;
          setOptionsExerciseId(null);
          removeExercise(optionsExercise);
        }}
        onOpenDetail={() => {
          if (!optionsExercise) return;
          setOptionsExerciseId(null);
          setDetailExerciseId(optionsExercise.exerciseId);
        }}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={deleteRoutine}
        title={`Delete "${state.name.trim() || "this routine"}"?`}
        message="The routine is removed from your list and from your week plan. Workouts you already logged with it stay in your history."
        confirmLabel="Delete routine"
        destructive
        isWorking={isDeleting}
        error={deleteError}
      />

      <ConfirmDialog
        isOpen={isLeaveOpen}
        onCancel={() => setIsLeaveOpen(false)}
        onConfirm={() => {
          // The user chose to drop the unsaved changes.
          savedRevision.current = revision.current;
          leave();
        }}
        title="Leave without saving?"
        message="Your latest changes to this routine could not be saved. If you leave now they are lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
      />

      {starter.dialog}
    </div>
  );
}

export default RoutineEditor;
