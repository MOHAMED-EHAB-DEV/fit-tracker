/**
 * The exercise list in the browser. It is fetched once and searched locally,
 * so the picker answers instantly and keeps working on a weak gym connection.
 */
import { api } from "@/lib/client/api";
import { normalizeExerciseName, searchTokens, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";

let catalogPromise: Promise<ExerciseDTO[]> | null = null;

/** Alphabetical, ignoring case and accents ("Ab Roller" before "barbell curl"). */
const byName = (a: ExerciseDTO, b: ExerciseDTO): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

export function loadExerciseCatalog(force: boolean = false): Promise<ExerciseDTO[]> {
  if (!catalogPromise || force) {
    catalogPromise = api<{ exercises: ExerciseDTO[] }>("/api/exercises")
      .then((data) => data.exercises)
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

/** Adds a just-created (or replaces a just-edited) custom exercise without refetching the whole list. */
export function addToExerciseCatalog(exercise: ExerciseDTO): void {
  if (!catalogPromise) return;
  catalogPromise = catalogPromise.then((list) =>
    [...list.filter((item) => item.id !== exercise.id), exercise].sort(byName)
  );
}

/** Drops a deleted custom exercise from the list in the browser. */
export function removeFromExerciseCatalog(exerciseId: string): void {
  if (!catalogPromise) return;
  catalogPromise = catalogPromise.then((list) => list.filter((item) => item.id !== exerciseId));
}

export interface ExerciseFilter {
  query: string;
  muscleGroup: MuscleGroup | "all";
  equipment: string | "all";
}

/**
 * Filters and ranks exercises for a search-box value and the chosen chips.
 * With an empty search box the list is alphabetical (the user's own exercises
 * first); with search text it is ranked by how well the name matches.
 */
export function filterExercises(list: ExerciseDTO[], filter: ExerciseFilter): ExerciseDTO[] {
  const tokens = searchTokens(filter.query);
  const wholeQuery = normalizeExerciseName(filter.query);

  const matchesChips = (exercise: ExerciseDTO): boolean =>
    (filter.muscleGroup === "all" || exercise.muscleGroup === filter.muscleGroup) &&
    (filter.equipment === "all" || exercise.equipment === filter.equipment);

  if (tokens.length === 0) {
    return list
      .filter(matchesChips)
      .sort((a, b) => Number(b.isCustom) - Number(a.isCustom) || byName(a, b));
  }

  const scored: Array<{ exercise: ExerciseDTO; score: number }> = [];
  for (const exercise of list) {
    if (!matchesChips(exercise)) continue;
    const name = normalizeExerciseName(exercise.name);
    const haystack = `${name} ${exercise.primaryMuscle} ${exercise.muscleGroup} ${exercise.equipment}`.toLowerCase();
    if (!tokens.every((token) => haystack.includes(token))) continue;

    let score = 3;
    if (name === wholeQuery) score = 0;
    else if (name.startsWith(wholeQuery)) score = 1;
    else if (tokens.every((token) => name.includes(token))) score = 2;
    scored.push({ exercise, score });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.exercise.isCustom) - Number(a.exercise.isCustom) ||
        a.exercise.name.length - b.exercise.name.length ||
        byName(a.exercise, b.exercise)
    )
    .map((item) => item.exercise);
}

const RECENT_KEY = "ft:recent-exercises";

export function recentExerciseIds(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberExercises(ids: string[]): void {
  try {
    const merged = [...ids, ...recentExerciseIds().filter((id) => !ids.includes(id))].slice(0, 24);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
  } catch {
    // Not essential.
  }
}
