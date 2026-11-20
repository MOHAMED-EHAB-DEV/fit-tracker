import React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatVolume, type WeightUnit } from "@/lib/fitness/units";
import { PR_KIND_LABELS, describeSetWithUnit, pluralize, relativeInstantLabel } from "@/lib/workouts/format";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { RecentPrSet } from "@/lib/workouts/records";

interface TrainingWeekWidgetProps {
  /** Logged working sets per muscle group this week. */
  setsByMuscleGroup: Record<string, number>;
  volumeKg: number;
  workoutCount: number;
  recentRecords: RecentPrSet[];
  unit: WeightUnit;
  today: string;
  timezone: string;
}

/** This week's training by muscle group, and the latest personal records. */
export function TrainingWeekWidget({
  setsByMuscleGroup,
  volumeKg,
  workoutCount,
  recentRecords,
  unit,
  today,
  timezone,
}: TrainingWeekWidgetProps) {
  const groups = Object.entries(setsByMuscleGroup)
    .filter(([, sets]) => sets > 0)
    .sort((a, b) => b[1] - a[1]);
  const mostSets = groups.length > 0 ? groups[0][1] : 0;

  return (
    <section aria-labelledby="training-week-title" className="rounded-3xl border border-line bg-surface p-4 sm:p-6 space-y-5">
      <header>
        <h2 id="training-week-title" className="text-base font-bold text-white">
          Training this week
        </h2>
        <p className="text-sm text-zinc-400">
          {workoutCount === 0
            ? "No workouts finished yet this week."
            : `${pluralize(workoutCount, "workout")} · ${formatVolume(volumeKg, unit)} lifted`}
        </p>
      </header>

      {groups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300">Sets per muscle group</h3>
          <ul className="mt-2 space-y-2">
            {groups.map(([group, sets]) => (
              <li key={group} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-zinc-300">
                  {MUSCLE_GROUP_LABELS[group as MuscleGroup] || group}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(4, Math.round((sets / mostSets) * 100))}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-end text-sm font-semibold text-white tabular-nums">
                  {pluralize(sets, "set")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
          Latest personal records
        </h3>
        {recentRecords.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">
            Records appear here when you beat your best weight, reps or estimated max on an exercise.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {recentRecords.map((record, index) => (
              <li key={`${record.sessionId}-${record.exerciseId}-${index}`}>
                <Link
                  href={`/workouts/history/${record.sessionId}`}
                  className="flex min-h-14 items-center gap-3 py-2 active:bg-white/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-white">{record.exerciseName}</span>
                    <span className="block truncate text-sm text-zinc-400">
                      {record.kinds.map((kind) => PR_KIND_LABELS[kind]).join(", ")} ·{" "}
                      {relativeInstantLabel(record.achievedAt, today, timezone)}
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-bold text-amber-300 tabular-nums">
                    {describeSetWithUnit({ ...record, distanceM: null }, record.unit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default TrainingWeekWidget;
