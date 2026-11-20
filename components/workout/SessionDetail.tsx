"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ListPlus, Pencil, Repeat, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { useStartWorkout } from "@/components/workout/useStartWorkout";
import { useUser } from "@/context/UserContext";
import { api, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { formatVolume } from "@/lib/fitness/units";
import { formatDateString, formatTimeInZone } from "@/lib/time";
import { formatDurationShort } from "@/lib/workouts/calc";
import { PR_KIND_LABELS, describeSet, setOrdinals } from "@/lib/workouts/format";
import { SET_TYPE_LABELS } from "@/lib/workouts/taxonomy";
import type { RoutineDTO, SessionDTO } from "@/lib/workouts/types";

interface SessionDetailProps {
  session: SessionDTO;
  /** The workout currently open, if any (repeating this one asks first). */
  active: { id: string; name: string } | null;
}

const PR_LABELS = PR_KIND_LABELS;

/** One finished workout: what was done, with repeat, edit, save as routine and delete. */
export function SessionDetail({ session, active }: SessionDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { weightUnit, timezone } = useUser();
  const starter = useStartWorkout(active);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);

  const deleteWorkout = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api(`/api/sessions/${session.id}`, { method: "DELETE" });
      markDashboardStale();
      toast("Workout deleted", "success");
      router.push("/workouts/history");
      router.refresh();
    } catch (err) {
      setDeleteError(errorMessage(err));
      setIsDeleting(false);
    }
  };

  const saveAsRoutine = async () => {
    if (isSavingRoutine) return;
    setIsSavingRoutine(true);
    try {
      const data = await api<{ routine: RoutineDTO }>("/api/routines", {
        method: "POST",
        body: { name: session.name.slice(0, 80) || "Routine", fromSessionId: session.id },
      });
      toast("Saved as a routine", "success");
      router.push(`/workouts/routines/${data.routine.id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
      setIsSavingRoutine(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-start gap-2">
        <Link
          href="/workouts/history"
          aria-label="Back to history"
          className="grid h-11 w-11 -ms-2 shrink-0 place-items-center rounded-full text-zinc-300 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-bold text-white break-words">{session.name}</h1>
          <p className="text-sm text-zinc-400">
            {formatDateString(session.localDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ·{" "}
            {formatTimeInZone(session.startedAt, timezone)}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Time" value={formatDurationShort(session.durationSec)} />
        <Stat label="Sets" value={String(session.totals.completedSets)} />
        <Stat label="Volume" value={formatVolume(session.totals.volumeKg, weightUnit)} />
        <Stat label="Active calories" value={`${session.totals.calories} kcal`} />
      </dl>

      {session.totals.prCount > 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          {session.totals.prCount === 1
            ? "1 personal record in this workout"
            : `${session.totals.prCount} personal records in this workout`}
        </p>
      )}

      {session.notes && (
        <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-zinc-300">
          {session.notes}
        </p>
      )}

      <section aria-label="Exercises" className="space-y-3">
        {session.exercises.map((exercise, index) => {
          const ordinals = setOrdinals(exercise.sets);
          return (
            <article key={exercise.id} className="rounded-3xl border border-line bg-surface p-4">
              <button
                type="button"
                onClick={() => setDetailExerciseId(exercise.exerciseId)}
                className="block w-full text-start rounded-lg cursor-pointer"
              >
                <h2 className="text-base font-semibold text-white">
                  <span className="text-zinc-400 tabular-nums">{index + 1}. </span>
                  {exercise.name}
                </h2>
                <p className="text-sm text-zinc-400">{exercise.primaryMuscle}</p>
              </button>
              {exercise.notes && <p className="mt-1 text-sm text-amber-200/90">{exercise.notes}</p>}
              <ol className="mt-3 space-y-1.5">
                {exercise.sets.map((set, setIndex) => {
                  const ordinal = ordinals[setIndex];
                  const label = SET_TYPE_LABELS[set.type];
                  return (
                    <li key={set.id} className="flex items-center gap-3 text-base">
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-bold text-zinc-300"
                        title={label.label}
                      >
                        {set.type === "working" ? ordinal : label.short}
                        <span className="sr-only"> {label.label}</span>
                      </span>
                      <span className="font-semibold text-white tabular-nums">{describeSet(set, exercise.unit)}</span>
                      {set.rpe != null && <span className="text-sm text-zinc-400 tabular-nums">RPE {set.rpe}</span>}
                      {set.prKinds.length > 0 && (
                        <span className="ms-auto flex items-center gap-1 text-sm font-medium text-amber-300">
                          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {set.prKinds.map((kind) => PR_LABELS[kind]).join(", ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </section>

      <section aria-label="Actions" className="grid grid-cols-2 gap-2">
        <Button
          className="col-span-2"
          size="lg"
          startContent={<Repeat className="h-5 w-5" />}
          isLoading={starter.busyKey === "repeat" || starter.isNavigating}
          disabled={starter.isBusy}
          onClick={() => void starter.start({ repeatSessionId: session.id }, "repeat")}
        >
          Do this workout again
        </Button>
        <Link
          href={`/workouts/session/${session.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-zinc-200 active:bg-white/5"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <Button
          variant="bordered"
          startContent={<ListPlus className="h-4 w-4" />}
          isLoading={isSavingRoutine}
          onClick={() => void saveAsRoutine()}
        >
          Save as routine
        </Button>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setIsDeleteOpen(true);
          }}
          className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-red-300 active:bg-red-500/10 cursor-pointer"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete workout
        </button>
      </section>

      <ExerciseDetailSheet exerciseId={detailExerciseId} onClose={() => setDetailExerciseId(null)} />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={deleteWorkout}
        title="Delete this workout?"
        message="It is removed from your history. Your personal records and that day's burned calories are recalculated without it. This cannot be undone."
        confirmLabel="Delete workout"
        destructive
        isWorking={isDeleting}
        error={deleteError}
      />

      {starter.dialog}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-base font-semibold text-white tabular-nums">{value}</dd>
    </div>
  );
}

export default SessionDetail;
