"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SuggestedCard } from "@/components/ui/SuggestedCard";
import { api, errorMessage } from "@/lib/client/api";
import { formatVolume, type WeightUnit } from "@/lib/fitness/units";
import { formatDurationShort } from "@/lib/workouts/calc";
import { PR_KIND_LABELS, describeRoutineSet, describeSet, describeSetWithUnit, pluralize } from "@/lib/workouts/format";
import type { PrKind, RoutineDTO, SessionDTO } from "@/lib/workouts/types";

export interface FinishedRecord {
  exerciseName: string;
  kinds: PrKind[];
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  unit: "kg" | "lbs";
}

export interface FinishSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** A workout typed in afterwards has no ticks: filled sets count. */
  isPastLog: boolean;
  sessionName: string;
  durationLabel: string;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  weightUnit: WeightUnit;
  /** New records already flagged while logging. */
  prCount: number;
  isWorking: boolean;
  error: string | null;
  onConfirm: () => void;
  result: { session: SessionDTO; records: FinishedRecord[] } | null;
  /** Whether there were earlier results to beat (for the "no records" line). */
  hadEarlierResults: boolean;
  onDone: () => void;
}

interface RoutineChange {
  name: string;
  before: string;
  after: string;
}

/** The heaviest (else the first) working set of each exercise, as text. */
function topSetText(
  sets: ReadonlyArray<{ type: string; weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null; done?: boolean }>,
  unit: WeightUnit
): string | null {
  const working = sets.filter((set) => set.type !== "warmup" && (set.done ?? true));
  if (working.length === 0) return null;
  const top = [...working].sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0];
  return describeSetWithUnit(top, unit);
}

function routineChanges(routine: RoutineDTO, session: SessionDTO): RoutineChange[] {
  const changes: RoutineChange[] = [];
  for (const exercise of routine.exercises) {
    const done = session.exercises.find((item) => item.exerciseId === exercise.exerciseId);
    if (!done) continue;
    const after = topSetText(done.sets, exercise.unit);
    const firstWorking = exercise.sets.find((set) => set.type !== "warmup") ?? exercise.sets[0];
    const before = firstWorking ? describeRoutineSet(firstWorking, exercise.unit) : "No target";
    if (after && after !== before) changes.push({ name: exercise.name, before, after });
  }
  return changes;
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-2.5 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</dd>
    </div>
  );
}

/**
 * Finishing a workout: one sheet that confirms (duration, sets, volume, what
 * will not be saved), then turns into the summary with new records and a
 * suggestion to make today's numbers the routine's targets.
 */
export function FinishSheet({
  isOpen,
  onClose,
  isPastLog,
  sessionName,
  durationLabel,
  setsDone,
  setsTotal,
  volumeKg,
  weightUnit,
  prCount,
  isWorking,
  error,
  onConfirm,
  result,
  hadEarlierResults,
  onDone,
}: FinishSheetProps) {
  const [changes, setChanges] = useState<RoutineChange[] | null>(null);
  const [suggestion, setSuggestion] = useState<"suggested" | "applied" | "dismissed">("suggested");
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const routineId = result?.session.routineId ?? null;

  // What updating the routine would change: its targets next to today's top sets.
  useEffect(() => {
    if (!routineId || !result) return;
    let cancelled = false;
    api<{ routine: RoutineDTO }>(`/api/routines/${routineId}`)
      .then((data) => {
        if (!cancelled) setChanges(routineChanges(data.routine, result.session));
      })
      .catch(() => {
        if (!cancelled) setChanges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [routineId, result]);

  const applyToRoutine = async () => {
    if (!routineId || !result) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      await api(`/api/routines/${routineId}/apply-session`, { method: "POST", body: { sessionId: result.session.id } });
      setSuggestion("applied");
    } catch (err) {
      setApplyError(errorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  const unticked = setsTotal - setsDone;

  if (result) {
    const totals = result.session.totals;
    // One primary action at a time: while the suggestion waits, Done steps back.
    const suggestionPending = Boolean(routineId && suggestion === "suggested" && changes && changes.length > 0);
    return (
      <Sheet isOpen={isOpen} onClose={onDone} title="Workout saved" description={result.session.name} showCloseButton={false} closeOnBackdropClick={false}>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 divide-line overflow-hidden rounded-control border border-line bg-surface [&>div:nth-child(2n)]:border-s [&>div:nth-child(n+3)]:border-t [&>div]:border-line">
            <StatCell label="Time" value={formatDurationShort(result.session.durationSec)} />
            <StatCell label="Sets" value={totals.completedSets} />
            <StatCell label="Volume" value={formatVolume(totals.volumeKg, weightUnit)} />
            <StatCell label="Active calories" value={`${totals.calories} kcal`} />
          </dl>

          {result.records.length > 0 ? (
            <section aria-label="Personal records" className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-warn">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                {result.records.length === 1 ? "New personal record" : `${result.records.length} new personal records`}
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface">
                {result.records.map((record, index) => (
                  <li key={index} className="px-3 py-2.5">
                    <p className="text-sm font-medium text-ink">{record.exerciseName}</p>
                    <p className="font-mono text-xs tabular-nums text-ink-2">
                      {describeSet({ ...record, distanceM: null }, record.unit)} ·{" "}
                      <span className="font-sans">{record.kinds.map((kind) => PR_KIND_LABELS[kind]).join(", ")}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-ink-2">
              {hadEarlierResults
                ? "No new records this time. Consistency is what builds them."
                : "These are your starting numbers. Beat them next time to set a record."}
            </p>
          )}

          {routineId && suggestion !== "dismissed" && changes !== null && changes.length > 0 && (
            <SuggestedCard
              meta="Routine update"
              state={suggestion === "applied" ? "applied" : "suggested"}
              acceptLabel="Update targets"
              isAccepting={isApplying}
              onAccept={() => void applyToRoutine()}
              onDismiss={() => setSuggestion("dismissed")}
            >
              <p className="mb-1.5 text-sm font-medium text-ink">Make today&apos;s numbers the targets for next time</p>
              <ul className="space-y-1">
                {changes.slice(0, 5).map((change) => (
                  <li key={change.name} className="flex justify-between gap-3 text-xs">
                    <span className="truncate text-ink-2">{change.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-ink-3">
                      {change.before} → <span className="text-ink">{change.after}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {applyError && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {applyError}
                </p>
              )}
            </SuggestedCard>
          )}

          <Button size="lg" fullWidth variant={suggestionPending ? "secondary" : "primary"} onClick={onDone}>
            Done
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={isWorking ? () => undefined : onClose}
      title={isPastLog ? "Save this workout?" : "Finish workout?"}
      description={`${sessionName}${prCount > 0 ? ` · ${pluralize(prCount, "new PR")} recorded` : ""}`}
      showCloseButton={false}
      closeOnBackdropClick={!isWorking}
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-control border border-line bg-surface">
          <StatCell label="Duration" value={durationLabel} />
          <StatCell
            label="Sets done"
            value={
              <>
                {setsDone}
                <span className="text-xs font-normal text-ink-3"> / {setsTotal}</span>
              </>
            }
          />
          <StatCell label="Volume" value={formatVolume(volumeKg, weightUnit)} />
        </dl>

        {setsDone === 0 ? (
          <p className="flex items-start gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-ink-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            {isPastLog
              ? "Nothing is logged yet. Fill in at least one set, or discard the log instead."
              : "Nothing is logged yet. Tick at least one set, or discard the workout instead."}
          </p>
        ) : unticked > 0 ? (
          <p className="flex items-start gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] leading-5 text-ink-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-ink">
                {pluralize(unticked, isPastLog ? "empty set" : "unticked set")}
              </strong>{" "}
              will not be saved to your workout history.
            </span>
          </p>
        ) : null}

        {error && (
          <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={onConfirm} isLoading={isWorking} disabled={setsDone === 0}>
            {isPastLog ? "Save workout" : "Complete workout"}
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isWorking}>
            Keep going
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export default FinishSheet;
