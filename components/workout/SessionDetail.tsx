"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, ListPlus, Pencil, Repeat, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
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
import { PR_KIND_LABELS, describeSet, pluralize, setOrdinals } from "@/lib/workouts/format";
import { SET_TYPE_LABELS } from "@/lib/workouts/taxonomy";
import { cn } from "@/lib/utils";
import type { RoutineDTO, SessionDTO } from "@/lib/workouts/types";

interface SessionDetailProps {
  session: SessionDTO;
  /** The workout currently open, if any (repeating this one asks first). */
  active: { id: string; name: string } | null;
}

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
    <div className="mx-auto max-w-[680px] space-y-4">
      <header className="flex items-start gap-1">
        <Link
          href="/workouts/history"
          aria-label="Back to history"
          className="-ms-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 className="break-words text-title font-semibold text-ink">{session.name}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            {formatDateString(session.localDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ·{" "}
            <span className="font-mono tabular-nums">{formatTimeInZone(session.startedAt, timezone)}</span>
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface sm:grid-cols-4 [&>div]:border-line max-sm:[&>div:nth-child(2n)]:border-s max-sm:[&>div:nth-child(n+3)]:border-t sm:[&>div+div]:border-s">
        <Stat label="Time" value={formatDurationShort(session.durationSec)} />
        <Stat label="Sets" value={String(session.totals.completedSets)} />
        <Stat label="Volume" value={formatVolume(session.totals.volumeKg, weightUnit)} />
        <Stat label="Active calories" value={`${session.totals.calories} kcal`} />
      </dl>

      {session.totals.prCount > 0 && (
        <p className="flex items-center gap-2 rounded-control border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium text-warn">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          {pluralize(session.totals.prCount, "personal record")} in this workout
        </p>
      )}

      {session.notes && (
        <p className="whitespace-pre-wrap rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm leading-5 text-ink-2">
          {session.notes}
        </p>
      )}

      <section aria-label="Exercises" className="space-y-3">
        {session.exercises.map((exercise, index) => {
          const ordinals = setOrdinals(exercise.sets);
          return (
            <article key={exercise.id} className="overflow-hidden rounded-card border border-line bg-surface">
              <button
                type="button"
                onClick={() => setDetailExerciseId(exercise.exerciseId)}
                aria-haspopup="dialog"
                className="flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors hover:bg-elevated/60 cursor-pointer"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">
                    <span className="font-mono tabular-nums text-ink-3">{index + 1}. </span>
                    {exercise.name}
                  </span>
                  <span className="mt-0.5 block text-xs capitalize text-ink-3">{exercise.primaryMuscle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              </button>
              {exercise.notes && <p className="px-3.5 pb-2 text-[13px] leading-5 text-ink-2">{exercise.notes}</p>}
              <ol className="divide-y divide-line border-t border-line">
                {exercise.sets.map((set, setIndex) => {
                  const ordinal = ordinals[setIndex];
                  const label = SET_TYPE_LABELS[set.type];
                  return (
                    <li key={set.id} className="flex min-h-11 items-center gap-3 px-3.5 py-2">
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-chip border border-line bg-elevated font-mono text-xs font-semibold tabular-nums",
                          set.type === "working" ? "text-ink-2" : "text-ink-3"
                        )}
                        title={label.label}
                      >
                        {set.type === "working" ? ordinal : label.short}
                        <span className="sr-only"> {label.label}</span>
                      </span>
                      <span className="font-mono text-sm font-medium tabular-nums text-ink">{describeSet(set, exercise.unit)}</span>
                      {set.rpe != null && <span className="font-mono text-xs tabular-nums text-ink-3">RPE {set.rpe}</span>}
                      {set.prKinds.length > 0 && (
                        <span className="ms-auto flex min-w-0 items-center gap-1 text-xs font-medium text-warn">
                          <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{set.prKinds.map((kind) => PR_KIND_LABELS[kind]).join(", ")}</span>
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
          startContent={<Repeat className="h-4 w-4" />}
          isLoading={starter.busyKey === "repeat" || starter.isNavigating}
          disabled={starter.isBusy}
          onClick={() => void starter.start({ repeatSessionId: session.id }, "repeat")}
        >
          Do again
        </Button>
        <Link href={`/workouts/session/${session.id}`} className={buttonClasses({ variant: "secondary" })}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <Button
          variant="secondary"
          startContent={<ListPlus className="h-4 w-4" />}
          isLoading={isSavingRoutine}
          onClick={() => void saveAsRoutine()}
        >
          Save as routine
        </Button>
        <Button
          variant="ghost"
          className="col-span-2 text-danger hover:text-danger"
          startContent={<Trash2 className="h-4 w-4" />}
          onClick={() => {
            setDeleteError(null);
            setIsDeleteOpen(true);
          }}
        >
          Delete workout
        </Button>
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
    <div className="min-w-0 px-3.5 py-2.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="truncate font-mono text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export default SessionDetail;
