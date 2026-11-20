"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { api, errorMessage } from "@/lib/client/api";
import { useUser } from "@/context/UserContext";
import { formatWeight } from "@/lib/fitness/units";
import { formatDateString } from "@/lib/time";
import { formatDuration } from "@/lib/workouts/calc";
import { describeSet } from "@/lib/workouts/format";
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO, PersonalRecordDTO, PrKind } from "@/lib/workouts/types";
import type { ExerciseHistoryEntry } from "@/lib/workouts/sessions";
import type { WeightUnit } from "@/lib/fitness/units";

interface ExerciseDetailSheetProps {
  exerciseId: string | null;
  onClose: () => void;
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

export { describeSet };

/** How to do an exercise, plus the user's own history and records for it. */
export function ExerciseDetailSheet({ exerciseId, onClose }: ExerciseDetailSheetProps) {
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

  return (
    <Drawer
      isOpen={Boolean(exerciseId)}
      onClose={onClose}
      title={exercise?.name || "Exercise"}
      description={
        exercise
          ? `${exercise.primaryMuscle} · ${EQUIPMENT_LABELS[exercise.equipment as Equipment] || exercise.equipment}`
          : undefined
      }
      position="bottom"
    >
      {error ? (
        <div className="py-8 text-center space-y-3">
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
          <Button variant="bordered" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      ) : !exercise ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          <div className="skeleton h-40" />
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-5 w-1/2" />
        </div>
      ) : (
        <div className="space-y-6">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((src, index) => (
                <div key={src} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-2">
                  <Image
                    src={src}
                    alt={`${exercise.name}, position ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 320px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {records.length > 0 && (
            <section aria-labelledby="exercise-records">
              <h3 id="exercise-records" className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
                Your records
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                {records.map((record) => (
                  <div key={record.kind} className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
                    <dt className="text-xs text-zinc-400">{RECORD_LABELS[record.kind]}</dt>
                    <dd className="text-base font-semibold text-white tabular-nums">{recordValue(record, weightUnit)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section aria-labelledby="exercise-history">
            <h3 id="exercise-history" className="mb-2 text-sm font-semibold text-white">
              Your history
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-zinc-400">You have not logged this exercise yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.slice(0, 8).map((entry) => (
                  <li key={entry.sessionId} className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
                    <p className="text-xs text-zinc-400">
                      {formatDateString(entry.localDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-sm text-white tabular-nums">
                      {entry.sets.map((set) => describeSet(set, entry.unit)).join("  ·  ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="exercise-how-to">
            <h3 id="exercise-how-to" className="mb-2 text-sm font-semibold text-white">
              How to do it
            </h3>
            {exercise.instructions && exercise.instructions.length > 0 ? (
              <ol className="space-y-2 list-decimal ps-5 text-sm text-zinc-300">
                {exercise.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-400">No instructions have been added for this exercise.</p>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

export default ExerciseDetailSheet;
