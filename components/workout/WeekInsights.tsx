import React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Surface } from "@/components/ui/Surface";
import { formatVolume, type WeightUnit } from "@/lib/fitness/units";
import { PR_KIND_LABELS, describeSetWithUnit, pluralize, relativeInstantLabel } from "@/lib/workouts/format";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { RecentPrSet } from "@/lib/workouts/records";

export interface WeekInsightsProps {
  /** Logged working sets per muscle group this week. */
  setsByMuscleGroup: Record<string, number>;
  volumeKg: number;
  workoutCount: number;
  recentRecords: RecentPrSet[];
  unit: WeightUnit;
  today: string;
  timezone: string;
}

/** This week's training (workouts, sets per muscle group, volume) and the latest records. */
export function WeekInsights({
  setsByMuscleGroup,
  volumeKg,
  workoutCount,
  recentRecords,
  unit,
  today,
  timezone,
}: WeekInsightsProps) {
  const groups = Object.entries(setsByMuscleGroup)
    .filter(([, sets]) => sets > 0)
    .sort((a, b) => b[1] - a[1]);
  const mostSets = groups.length > 0 ? groups[0][1] : 0;
  const totalSets = groups.reduce((sum, [, sets]) => sum + sets, 0);

  return (
    <div className="space-y-3">
      <Surface as="section" aria-labelledby="week-insights-title" padded={false}>
        <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
          <h2 id="week-insights-title" className="text-[13px] font-semibold text-ink-2">
            This week
          </h2>
          {workoutCount === 0 && <span className="text-xs text-ink-3">No workouts yet</span>}
        </div>
        <dl className="mt-2 grid grid-cols-3 divide-x divide-line border-y border-line">
          <div className="px-3.5 py-2.5">
            <dt className="text-xs text-ink-3">Workouts</dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-ink">{workoutCount}</dd>
          </div>
          <div className="px-3.5 py-2.5">
            <dt className="text-xs text-ink-3">Sets</dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-ink">{totalSets}</dd>
          </div>
          <div className="min-w-0 px-3.5 py-2.5">
            <dt className="text-xs text-ink-3">Volume</dt>
            <dd className="truncate font-mono text-lg font-semibold tabular-nums text-ink">{formatVolume(volumeKg, unit)}</dd>
          </div>
        </dl>
        <div className="px-3.5 pb-3.5 pt-3">
          <h3 className="mb-2 text-xs font-medium text-ink-3">Sets per muscle group</h3>
          {groups.length === 0 ? (
            <p className="text-[13px] text-ink-2">Finish a workout to see how your sets are spread.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map(([group, sets]) => (
                <li key={group} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                  <span className="truncate text-[13px] text-ink-2">{MUSCLE_GROUP_LABELS[group as MuscleGroup] || group}</span>
                  <span className="track-ticks relative h-1 overflow-hidden rounded-[2px] bg-elevated" aria-hidden="true">
                    <span
                      className="block h-full rounded-[2px] bg-ink"
                      style={{ width: `${Math.max(4, Math.round((sets / mostSets) * 100))}%` }}
                    />
                  </span>
                  <span className="text-end font-mono text-[13px] tabular-nums text-ink">
                    {sets}
                    <span className="sr-only"> {sets === 1 ? "set" : "sets"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Surface>

      <section aria-labelledby="recent-records-title" className="space-y-2">
        <SectionHeader
          id="recent-records-title"
          title={
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
              Latest records
            </span>
          }
          meta={recentRecords.length > 0 ? pluralize(recentRecords.length, "record") : undefined}
        />
        {recentRecords.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-3.5 py-3 text-[13px] leading-5 text-ink-2">
            Records appear here when you beat your best weight, reps or estimated max on an exercise.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {recentRecords.map((record, index) => (
              <li key={`${record.sessionId}-${record.exerciseId}-${index}`}>
                <Link
                  href={`/workouts/history/${record.sessionId}`}
                  className="flex min-h-12 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-elevated/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{record.exerciseName}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">
                      {record.kinds.map((kind) => PR_KIND_LABELS[kind]).join(", ")} ·{" "}
                      {relativeInstantLabel(record.achievedAt, today, timezone)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-warn">
                    {describeSetWithUnit({ ...record, distanceM: null }, record.unit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default WeekInsights;
