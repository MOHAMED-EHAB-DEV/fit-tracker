"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Pencil, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { ExerciseProgressChart } from "@/components/workout/ExerciseProgressChart";
import { api, errorMessage } from "@/lib/client/api";
import { useUser } from "@/context/UserContext";
import { formatWeight, type WeightUnit } from "@/lib/fitness/units";
import { formatDateString } from "@/lib/time";
import { formatDuration } from "@/lib/workouts/calc";
import { describeSet } from "@/lib/workouts/format";
import { exerciseProgress, type ProgressMetric } from "@/lib/workouts/progress";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO, PersonalRecordDTO, PrKind } from "@/lib/workouts/types";
import type { ExerciseHistoryEntry } from "@/lib/workouts/sessions";

interface ExerciseDetailSheetProps {
  exerciseId: string | null;
  onClose: () => void;
  /** Custom exercises only: edit from the library. */
  onEdit?: (exercise: ExerciseDTO) => void;
  /** Custom exercises only: delete from the library. */
  onDelete?: (exercise: ExerciseDTO) => void;
}

const RECORD_LABELS: Record<PrKind, string> = {
  e1rm: "Estimated 1-rep max",
  weight: "Heaviest weight",
  volume: "Best set volume",
  reps: "Most reps",
  duration: "Longest time",
  distance: "Longest distance",
};

function recordValue(record: PersonalRecordDTO, unit: WeightUnit): string {
  switch (record.kind) {
    case "e1rm":
    case "weight":
    case "volume":
      return formatWeight(record.value, unit);
    case "reps":
      return `${record.value} reps`;
    case "duration":
      return formatDuration(record.value);
    case "distance":
      return `${(record.value / 1000).toFixed(2)} km`;
    default:
      return String(record.value);
  }
}

function progressFormatter(metric: ProgressMetric, unit: WeightUnit): (value: number) => string {
  switch (metric) {
    case "e1rm":
      return (value) => `${Number(value.toFixed(1))} ${unit}`;
    case "reps":
      return (value) => `${Math.round(value)} reps`;
    case "duration":
      return (value) => formatDuration(Math.round(value));
    case "distance":
      return (value) => `${value.toFixed(2)} km`;
  }
}

export { describeSet };

/** How to do an exercise, plus the user's own records, progress and history for it. */
export function ExerciseDetailSheet({ exerciseId, onClose, onEdit, onDelete }: ExerciseDetailSheetProps) {
  const { weightUnit } = useUser();
  const [exercise, setExercise] = useState<ExerciseDTO | null>(null);
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [records, setRecords] = useState<PersonalRecordDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!exerciseId) return;
    // A flag, not an AbortController: a superseded load is ignored, never aborted.
    let stale = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the previous exercise while the next loads
    setExercise(null);
    setHistory([]);
    setRecords([]);
    setError(null);

    Promise.all([
      api<{ exercise: ExerciseDTO }>(`/api/exercises/${exerciseId}`),
      api<{ history: ExerciseHistoryEntry[]; records: PersonalRecordDTO[] }>(`/api/exercises/${exerciseId}/history`),
    ])
      .then(([detail, past]) => {
        if (stale) return;
        setExercise(detail.exercise);
        setHistory(past.history);
        setRecords(past.records);
      })
      .catch((err) => {
        if (stale) return;
        setError(errorMessage(err, "This exercise could not be loaded."));
      });

    return () => {
      stale = true;
    };
  }, [exerciseId, reloadKey]);

  const images = (exercise?.images || []).slice(0, 2);
  const progress = exercise ? exerciseProgress(history, exercise.trackingType, weightUnit) : null;
  const canManage = Boolean(exercise?.isCustom && (onEdit || onDelete));

  return (
    <Sheet
      isOpen={Boolean(exerciseId)}
      onClose={onClose}
      title={exercise?.name || "Exercise"}
      description={
        exercise ? (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="capitalize">{exercise.primaryMuscle}</span>
            <span aria-hidden="true">·</span>
            <span>{EQUIPMENT_LABELS[exercise.equipment as Equipment] || exercise.equipment}</span>
            {exercise.isCustom && <Chip size="sm">Custom</Chip>}
          </span>
        ) : undefined
      }
      size="lg"
      footer={
        canManage && exercise ? (
          <div className="grid grid-cols-2 gap-2">
            {onEdit && (
              <Button variant="secondary" startContent={<Pencil className="h-4 w-4" />} onClick={() => onEdit(exercise)}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" startContent={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(exercise)}>
                Delete
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {error ? (
        <div className="space-y-3 py-8 text-center">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      ) : !exercise ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-32" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : (
        <div className="space-y-5">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((src, index) => (
                <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-control border border-line bg-elevated">
                  <Image
                    src={src}
                    alt={`${exercise.name}, position ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 280px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {records.length > 0 && (
            <section aria-labelledby="exercise-records" className="space-y-2">
              <h3 id="exercise-records" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                <Trophy className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
                Your records
              </h3>
              <dl className="grid grid-cols-2 overflow-hidden rounded-control border border-line bg-surface [&>div:nth-child(2n)]:border-s [&>div:nth-child(n+3)]:border-t [&>div]:border-line">
                {records.map((record) => (
                  <div key={record.kind} className="min-w-0 px-3 py-2.5">
                    <dt className="truncate text-xs text-ink-3">{RECORD_LABELS[record.kind]}</dt>
                    <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-ink">
                      {recordValue(record, weightUnit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {progress && progress.points.length >= 2 && (
            <section aria-labelledby="exercise-progress" className="space-y-2">
              <h3 id="exercise-progress" className="text-[13px] font-semibold text-ink-2">
                Progress
              </h3>
              <ExerciseProgressChart
                label={progress.label}
                points={progress.points}
                format={progressFormatter(progress.metric, weightUnit)}
              />
            </section>
          )}

          <section aria-labelledby="exercise-history" className="space-y-2">
            <h3 id="exercise-history" className="text-[13px] font-semibold text-ink-2">
              Your history
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-ink-2">You have not logged this exercise yet.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
                {history.slice(0, 8).map((entry) => (
                  <li key={entry.sessionId} className="px-3 py-2.5">
                    <p className="text-xs text-ink-3">
                      {formatDateString(entry.localDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="mt-0.5 font-mono text-[13px] leading-5 tabular-nums text-ink">
                      {entry.sets.map((set) => describeSet(set, entry.unit)).join("  ·  ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="exercise-how-to" className="space-y-2">
            <h3 id="exercise-how-to" className="text-[13px] font-semibold text-ink-2">
              How to do it
            </h3>
            {exercise.instructions && exercise.instructions.length > 0 ? (
              <ol className="list-decimal space-y-1.5 ps-5 text-sm leading-5 text-ink-2 marker:font-mono marker:text-ink-3">
                {exercise.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-2">No instructions have been added for this exercise.</p>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

export default ExerciseDetailSheet;
