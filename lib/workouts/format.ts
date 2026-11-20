/**
 * Display helpers for the workout screens. No React and no server-only
 * imports, so server components, client components and tests can all use it.
 */
import { daysBetween, formatDateString, localDateString } from "@/lib/time";
import { MUSCLE_GROUP_LABELS, type MuscleGroup, type SetType } from "@/lib/workouts/taxonomy";
import type { PrKind, RoutineSetDTO } from "@/lib/workouts/types";
import { formatWeight, fromKg, type WeightUnit } from "@/lib/fitness/units";
import { formatDuration } from "@/lib/workouts/calc";

/** What each kind of personal record is called on screen. */
export const PR_KIND_LABELS: Record<PrKind, string> = {
  e1rm: "Best estimated max",
  weight: "Heaviest weight",
  volume: "Best set",
  reps: "Most reps",
  duration: "Longest time",
  distance: "Longest distance",
};

/**
 * The number shown on each set: its position among sets of its kind
 * (warm-ups are counted separately from the other sets).
 */
export function setOrdinals(sets: ReadonlyArray<{ type: SetType }>): number[] {
  let warmups = 0;
  let others = 0;
  return sets.map((set) => (set.type === "warmup" ? (warmups += 1) : (others += 1)));
}

/** "80 × 8", "12 reps", "1:30" or "5.00 km · 25:00" for a logged set. */
export function describeSet(
  set: { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null },
  unit: WeightUnit
): string {
  if (set.durationSec && !set.reps) {
    return set.distanceM
      ? `${(set.distanceM / 1000).toFixed(2)} km · ${formatDuration(set.durationSec)}`
      : formatDuration(set.durationSec);
  }
  if (set.distanceM && !set.reps) return `${(set.distanceM / 1000).toFixed(2)} km`;
  if (set.weightKg && set.weightKg > 0) return `${formatWeight(set.weightKg, unit, false)} × ${set.reps ?? 0}`;
  return `${set.reps ?? 0} reps`;
}

/** The same, with the unit spelled out: "80 kg × 8". */
export function describeSetWithUnit(
  set: { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null },
  unit: WeightUnit
): string {
  if (set.weightKg && set.weightKg > 0 && set.reps) return `${formatWeight(set.weightKg, unit)} × ${set.reps}`;
  return describeSet(set, unit);
}

/** "Today", "Yesterday", "3 days ago", otherwise a short date. */
export function relativeDayLabel(dateString: string, today: string): string {
  const days = daysBetween(dateString, today);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  const sameYear = dateString.slice(0, 4) === today.slice(0, 4);
  return formatDateString(dateString, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** The same label for an instant, in the user's time zone. */
export function relativeInstantLabel(iso: string | null, today: string, timezone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return relativeDayLabel(localDateString(date, timezone), today);
}

/** "Chest, Shoulders, Arms" from a list of muscle groups. */
export function muscleGroupSummary(groups: MuscleGroup[], max: number = 3): string {
  const labels = groups.filter((group) => group !== "other").map((group) => MUSCLE_GROUP_LABELS[group]);
  if (labels.length === 0) return "";
  return labels.length > max ? `${labels.slice(0, max).join(", ")} +${labels.length - max}` : labels.join(", ");
}

export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "8–12 reps", "10 reps", "45 sec" for a planned set. */
export function describeRoutineSet(set: RoutineSetDTO, unit: WeightUnit): string {
  if (set.targetDurationSec) return formatDuration(set.targetDurationSec);
  const reps =
    set.repMin && set.repMax && set.repMin !== set.repMax
      ? `${set.repMin}–${set.repMax}`
      : set.repMax || set.repMin
        ? String(set.repMax || set.repMin)
        : "";
  const weight = set.targetWeightKg ? `${fromKg(set.targetWeightKg, unit, 1)} ${unit}` : "";
  if (weight && reps) return `${weight} × ${reps}`;
  if (reps) return `${reps} reps`;
  return weight || "No target";
}

/** Value for an `<input type="datetime-local">` showing an instant in the device's zone. */
export function toDateTimeLocalValue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
