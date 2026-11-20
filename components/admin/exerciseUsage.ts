import type { ExerciseUsage } from "@/lib/admin/exercises";

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** "Used in 3 routines and 41 logged workouts." */
export function usageSummary(usage: ExerciseUsage): string {
  const workouts = usage.sessions + usage.legacyWorkouts;
  const routines = usage.routines + usage.legacyTemplates;
  if (workouts === 0 && routines === 0) return "No routine or logged workout uses it.";
  return `Used in ${plural(routines, "routine", "routines")} and ${plural(workouts, "logged workout", "logged workouts")}.`;
}
