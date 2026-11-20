"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumberField } from "@/components/ui/NumberField";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { fromKg, toKg, type WeightUnit } from "@/lib/fitness/units";
import { formatRestTime, restChoicesWith } from "@/lib/workouts/calc";
import { setOrdinals } from "@/lib/workouts/format";
import { newId } from "@/lib/workouts/session-state";
import { SET_TYPE_LABELS, nextSetType, type TrackingType } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO, RoutineDTO, RoutineExerciseDTO, RoutineSetDTO } from "@/lib/workouts/types";

interface RoutineEditorProps {
  initialRoutine: RoutineDTO;
  /** The workout currently open, if any (starting another one asks first). */
  active: { id: string; name: string } | null;
}

type EditorSet = RoutineSetDTO & { key: string };
type EditorExercise = Omit<RoutineExerciseDTO, "sets"> & { sets: EditorSet[] };

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
      sets: exercise.sets.map((set) => ({ ...set, key: newId() })),
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

/** Builds and edits a routine. Every change is saved automatically. */
export function RoutineEditor({ initialRoutine, active }: RoutineEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, weightUnit } = useUser();
  const defaultRestSec = user?.preferences?.restTimerDefaultSec ?? 90;
  const starter = useStartWorkout(active);

  const [state, setState] = useState<EditorState>(() => toEditorState(initialRoutine));
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; restore: (current: EditorState) => EditorState } | null>(null);
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

  useEffect(() => {
    if (!undo) return;
    const timeout = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(timeout);
  }, [undo]);

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
    setUndo({
      label: "Set removed",
      restore: (current) => ({
        ...current,
        exercises: current.exercises.map((item) => {
          if (item.id !== exercise.id) return item;
          const sets = [...item.sets];
          sets.splice(Math.min(index, sets.length), 0, removed);
          return { ...item, sets };
        }),
      }),
    });
  };

  const removeExercise = (exercise: EditorExercise) => {
    const index = state.exercises.findIndex((item) => item.id === exercise.id);
    change((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }));
    setUndo({
      label: `${exercise.name} removed`,
      restore: (current) => {
        const exercises = [...current.exercises];
        exercises.splice(Math.min(index, exercises.length), 0, exercise);
        return { ...current, exercises };
      },
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
        setUndo({
          label: `${replaced.name} replaced`,
          restore: (current) => ({
            ...current,
            exercises: current.exercises.map((exercise) => (exercise.id === replacement.id ? replaced : exercise)),
          }),
        });
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

  const menuExercise = menuExerciseId ? state.exercises.find((exercise) => exercise.id === menuExerciseId) : undefined;
  const nameMissing = state.name.trim().length === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 bg-app/95 backdrop-blur-sm border-b border-line">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void goBack()}
            aria-label="Back to Train"
            className="grid place-items-center w-11 h-11 -ms-2 rounded-full text-zinc-300 active:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={state.name}
              onChange={(event) => {
                const name = event.target.value.slice(0, 80);
                change((current) => ({ ...current, name }));
              }}
              aria-label="Routine name"
              aria-invalid={nameMissing}
              placeholder="Routine name"
              className="w-full bg-transparent text-lg font-bold text-white truncate rounded-md px-1 -mx-1 placeholder:text-zinc-500"
            />
            <p className="px-0.5 text-xs" aria-live="polite">
              {nameMissing ? (
                <span className="text-amber-300">A routine needs a name.</span>
              ) : status === "saved" ? (
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Saved
                </span>
              ) : status === "saving" ? (
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Saving
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Not saved
                </span>
              )}
            </p>
          </div>
          <Button
            startContent={<Play className="w-4 h-4" />}
            isLoading={starter.busyKey === "start" || starter.isNavigating}
            disabled={state.exercises.length === 0 || starter.isBusy}
            onClick={() => void startWorkout()}
          >
            Start
          </Button>
        </div>
        {status === "error" && (
          <div
            role="alert"
            className="mt-2 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            <span className="flex-1">{saveError}</span>
            <button
              type="button"
              onClick={() => void saveNow()}
              className="min-h-11 px-2 font-semibold text-white underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}
      </header>

      <div className="mt-4 space-y-3 pb-28">
        <Textarea
          label="Note (optional)"
          value={state.notes}
          onChange={(event) => {
            const notes = event.target.value.slice(0, 1000);
            change((current) => ({ ...current, notes }));
          }}
          rows={2}
          placeholder="Anything to remember about this routine"
        />

        {state.exercises.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-base font-semibold text-white">No exercises yet</p>
            <p className="mt-1 text-sm text-zinc-400">Add the exercises you do in this routine.</p>
          </div>
        ) : (
          state.exercises.map((exercise, index) => (
            <RoutineExerciseCard
              key={exercise.id}
              exercise={exercise}
              position={index + 1}
              onOpenDetail={() => setDetailExerciseId(exercise.exerciseId)}
              onOpenMenu={() => setMenuExerciseId(exercise.id)}
              onUpdateSet={(key, patch) => updateSet(exercise.id, key, patch)}
              onRemoveSet={(key) => removeSet(exercise, key)}
              onAddSet={() => addSet(exercise)}
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

        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setIsDeleteOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 min-h-11 text-sm font-medium text-red-300 rounded-xl active:bg-red-500/10 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          Delete routine
        </button>
      </div>

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
                change(undo.restore);
                setUndo(null);
              }}
              className="min-h-11 px-3 text-sm font-semibold text-emerald-300 rounded-lg cursor-pointer"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      <ExercisePicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        mode={replaceTarget ? "single" : "multi"}
        title={replaceTarget ? "Replace exercise" : undefined}
        onAdd={addExercises}
      />

      <ExerciseDetailSheet exerciseId={detailExerciseId} onClose={() => setDetailExerciseId(null)} />

      <Drawer
        isOpen={Boolean(menuExercise)}
        onClose={() => setMenuExerciseId(null)}
        title={menuExercise?.name || "Exercise"}
        position="bottom"
      >
        {menuExercise && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="bordered"
                startContent={<ArrowUp className="w-4 h-4" />}
                disabled={state.exercises[0]?.id === menuExercise.id}
                onClick={() => moveExercise(menuExercise.id, -1)}
              >
                Move up
              </Button>
              <Button
                variant="bordered"
                startContent={<ArrowDown className="w-4 h-4" />}
                disabled={state.exercises[state.exercises.length - 1]?.id === menuExercise.id}
                onClick={() => moveExercise(menuExercise.id, 1)}
              >
                Move down
              </Button>
            </div>

            {isRepBased(menuExercise.trackingType) && (
              <div>
                <p className="mb-2 text-sm text-zinc-300">Weight unit for this exercise</p>
                <div role="group" aria-label="Weight unit" className="grid grid-cols-2 gap-2">
                  {(["kg", "lbs"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      aria-pressed={menuExercise.unit === unit}
                      onClick={() => updateExercise(menuExercise.id, (exercise) => ({ ...exercise, unit }))}
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
              </div>
            )}

            <Select<number>
              label="Rest after each set"
              options={restChoicesWith(menuExercise.restSec ?? defaultRestSec).map((seconds) => ({
                value: seconds,
                label: formatRestTime(seconds),
              }))}
              value={menuExercise.restSec ?? defaultRestSec}
              onChange={(restSec) => {
                updateExercise(menuExercise.id, (exercise) => ({ ...exercise, restSec }));
              }}
            />

            <Textarea
              label="Note"
              value={menuExercise.notes}
              onChange={(event) => {
                const notes = event.target.value.slice(0, 500);
                updateExercise(menuExercise.id, (exercise) => ({ ...exercise, notes }));
              }}
              rows={2}
              placeholder="Seat height, grip, tempo…"
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="bordered"
                startContent={<Repeat className="w-4 h-4" />}
                onClick={() => {
                  setReplaceTarget(menuExercise.id);
                  setMenuExerciseId(null);
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
                  setMenuExerciseId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </Drawer>

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

interface RoutineExerciseCardProps {
  exercise: EditorExercise;
  position: number;
  onOpenDetail: () => void;
  onOpenMenu: () => void;
  onUpdateSet: (key: string, patch: Partial<RoutineSetDTO>) => void;
  onRemoveSet: (key: string) => void;
  onAddSet: () => void;
}

function RoutineExerciseCard({
  exercise,
  position,
  onOpenDetail,
  onOpenMenu,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
}: RoutineExerciseCardProps) {
  const repBased = isRepBased(exercise.trackingType);
  const ordinals = setOrdinals(exercise.sets);

  return (
    <article className="rounded-3xl border border-line bg-surface p-3 sm:p-4">
      <header className="flex items-start gap-2 ps-1.5">
        <button type="button" onClick={onOpenDetail} className="flex-1 min-w-0 text-start rounded-lg cursor-pointer">
          <h3 className="text-base font-semibold text-white">
            <span className="text-zinc-400 tabular-nums">{position}. </span>
            {exercise.name}
          </h3>
          <p className="text-sm text-zinc-400 truncate">
            {exercise.primaryMuscle}
            {exercise.restSec ? ` · rest ${formatRestTime(exercise.restSec)}` : ""}
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={`Options for ${exercise.name}`}
          aria-haspopup="dialog"
          className="grid place-items-center w-11 h-11 rounded-full text-zinc-300 active:bg-white/10 shrink-0 cursor-pointer"
        >
          <MoreVertical className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {exercise.notes && <p className="mt-1 ps-1.5 text-sm text-amber-200/90">{exercise.notes}</p>}

      {exercise.sets.length > 0 && (
        <div className="mt-2 flex items-center gap-2 px-1.5 text-xs text-zinc-400" aria-hidden="true">
          <span className="w-11 shrink-0 text-center">Set</span>
          {repBased ? (
            <>
              <span className="flex-1 text-center">
                {exercise.trackingType === "bodyweight_reps" ? "Added weight" : "Weight"}
              </span>
              <span className="flex-[1.4] text-center">Reps (from – to)</span>
            </>
          ) : (
            <span className="flex-1 text-center">{exercise.trackingType === "cardio" ? "Time" : "Hold time"}</span>
          )}
          <span className="w-11 shrink-0" />
        </div>
      )}

      <div className="mt-1 space-y-1">
        {exercise.sets.map((set, setIndex) => {
          const ordinal = ordinals[setIndex];
          const typeLabel = SET_TYPE_LABELS[set.type];
          const setName = `${typeLabel.label} ${ordinal}`;
          return (
            <div key={set.key} className="flex items-center gap-2 px-1.5 py-1">
              <button
                type="button"
                onClick={() => onUpdateSet(set.key, { type: nextSetType(set.type) })}
                aria-label={`${setName} of ${exercise.name}. Tap to change the set type`}
                title="Tap to change: working, warm-up, drop set, to failure"
                className={cn(
                  "grid place-items-center w-11 h-12 rounded-xl text-sm font-bold shrink-0 cursor-pointer",
                  set.type === "warmup"
                    ? "bg-amber-500/15 text-amber-300"
                    : set.type === "working"
                      ? "bg-surface-2 text-zinc-200"
                      : "bg-sky-500/15 text-sky-300"
                )}
              >
                {set.type === "working" ? ordinal : typeLabel.short}
              </button>

              {repBased ? (
                <>
                  <NumberField
                    className="flex-1 min-w-0"
                    label={`${setName} target weight in ${exercise.unit}`}
                    value={set.targetWeightKg == null ? null : fromKg(set.targetWeightKg, exercise.unit, 2)}
                    onChange={(value) =>
                      onUpdateSet(set.key, { targetWeightKg: value == null ? null : toKg(value, exercise.unit) })
                    }
                    decimals={2}
                    max={exercise.unit === "lbs" ? 4400 : 2000}
                    suffix={exercise.unit}
                    placeholder="–"
                  />
                  <div className="flex flex-[1.4] min-w-0 items-center gap-1">
                    <NumberField
                      className="flex-1 min-w-0"
                      label={`${setName} reps from`}
                      value={set.repMin}
                      onChange={(value) => onUpdateSet(set.key, { repMin: value })}
                      max={1000}
                      placeholder="–"
                    />
                    <span className="text-zinc-500" aria-hidden="true">
                      –
                    </span>
                    <NumberField
                      className="flex-1 min-w-0"
                      label={`${setName} reps to`}
                      value={set.repMax}
                      onChange={(value) => onUpdateSet(set.key, { repMax: value })}
                      max={1000}
                      placeholder="–"
                    />
                  </div>
                </>
              ) : exercise.trackingType === "cardio" ? (
                <NumberField
                  className="flex-1 min-w-0"
                  label={`${setName} target time in minutes`}
                  value={set.targetDurationSec == null ? null : Math.round((set.targetDurationSec / 60) * 10) / 10}
                  onChange={(value) =>
                    onUpdateSet(set.key, { targetDurationSec: value == null ? null : Math.round(value * 60) })
                  }
                  decimals={1}
                  max={1440}
                  suffix="min"
                  placeholder="–"
                />
              ) : (
                <NumberField
                  className="flex-1 min-w-0"
                  label={`${setName} target time in seconds`}
                  value={set.targetDurationSec}
                  onChange={(value) => onUpdateSet(set.key, { targetDurationSec: value })}
                  max={86_400}
                  suffix="sec"
                  placeholder="–"
                />
              )}

              <button
                type="button"
                onClick={() => onRemoveSet(set.key)}
                aria-label={`Remove ${setName} of ${exercise.name}`}
                className="grid place-items-center w-11 h-11 rounded-full text-zinc-400 active:bg-white/10 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
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

export default RoutineEditor;
