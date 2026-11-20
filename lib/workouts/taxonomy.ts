/**
 * Exercise vocabulary shared by the server and the browser: muscle groups,
 * how an exercise is tracked, and the rules that derive both from a catalog
 * entry. One list, used everywhere (filters, stats, forms).
 */

export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "legs", "core", "cardio", "other"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
  other: "Other",
};

/** Specific muscles (as stored in `primaryMuscle`) per group. */
export const MUSCLES_BY_GROUP: Record<MuscleGroup, string[]> = {
  chest: ["Chest"],
  back: ["Lats", "Middle Back", "Lower Back", "Traps", "Back"],
  shoulders: ["Shoulders", "Neck"],
  arms: ["Biceps", "Triceps", "Forearms"],
  legs: ["Quadriceps", "Hamstrings", "Calves", "Glutes", "Adductors", "Abductors"],
  core: ["Abdominals", "Core"],
  cardio: [],
  other: [],
};

export const PRIMARY_MUSCLES = [
  "Chest",
  "Lats",
  "Middle Back",
  "Lower Back",
  "Traps",
  "Shoulders",
  "Neck",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quadriceps",
  "Hamstrings",
  "Calves",
  "Glutes",
  "Adductors",
  "Abductors",
  "Abdominals",
] as const;

const GROUP_BY_MUSCLE = new Map<string, MuscleGroup>();
for (const group of MUSCLE_GROUPS) {
  for (const muscle of MUSCLES_BY_GROUP[group]) GROUP_BY_MUSCLE.set(muscle.toLowerCase(), group);
}
// Broad names that older data may contain.
GROUP_BY_MUSCLE.set("arms", "arms");
GROUP_BY_MUSCLE.set("legs", "legs");
GROUP_BY_MUSCLE.set("upper back", "back");
GROUP_BY_MUSCLE.set("rhomboids", "back");
GROUP_BY_MUSCLE.set("front delts", "shoulders");
GROUP_BY_MUSCLE.set("rear delts", "shoulders");
GROUP_BY_MUSCLE.set("upper chest", "chest");
GROUP_BY_MUSCLE.set("obliques", "core");

/** How an exercise is logged. */
export const TRACKING_TYPES = ["weight_reps", "bodyweight_reps", "duration", "cardio"] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  weight_reps: "Weight × reps",
  bodyweight_reps: "Bodyweight reps (+ optional added weight)",
  duration: "Time (holds, stretches)",
  cardio: "Cardio (time + optional distance)",
};

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "bands",
  "medicine ball",
  "exercise ball",
  "foam roll",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  bands: "Bands",
  "medicine ball": "Medicine ball",
  "exercise ball": "Exercise ball",
  "foam roll": "Foam roll",
  other: "Other",
};

export const EXERCISE_CATEGORIES = [
  "strength",
  "stretching",
  "plyometrics",
  "powerlifting",
  "olympic weightlifting",
  "strongman",
  "cardio",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export function muscleGroupOf(primaryMuscle?: string | null, category?: string | null): MuscleGroup {
  if ((category || "").toLowerCase() === "cardio") return "cardio";
  return GROUP_BY_MUSCLE.get((primaryMuscle || "").trim().toLowerCase()) || "other";
}

const HOLD_NAME_RE = /\b(plank|hold|hang|wall sit|l-sit|bridge hold|dead hang|isometric)\b/i;

/** Derives how an exercise should be logged from its catalog fields. */
export function trackingTypeOf(exercise: {
  name?: string | null;
  equipment?: string | null;
  category?: string | null;
}): TrackingType {
  const category = (exercise.category || "").toLowerCase();
  const equipment = (exercise.equipment || "").toLowerCase();
  const name = exercise.name || "";

  if (category === "cardio") return "cardio";
  if (category === "stretching" || equipment === "foam roll") return "duration";
  if (HOLD_NAME_RE.test(name)) return "duration";
  if (equipment === "bodyweight" || equipment === "body only") return "bodyweight_reps";
  return "weight_reps";
}

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Short words people type in the gym, expanded for search. */
const SEARCH_ALIASES: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  bw: "bodyweight",
  pullup: "pull up",
  pullups: "pull up",
  chinup: "chin up",
  pushup: "push up",
  pushups: "push up",
  situp: "sit up",
  tricep: "triceps",
  bicep: "biceps",
  abs: "abdominals",
  quads: "quadriceps",
  hams: "hamstrings",
  delts: "shoulders",
};

/** Splits a search box value into normalized tokens, expanding gym shorthand. */
export function searchTokens(query: string): string[] {
  const tokens: string[] = [];
  for (const raw of normalizeExerciseName(query).split(" ")) {
    if (!raw) continue;
    // Own keys only: "constructor" or "toString" must not hit Object.prototype.
    const expanded = Object.prototype.hasOwnProperty.call(SEARCH_ALIASES, raw) ? SEARCH_ALIASES[raw] : undefined;
    if (expanded) tokens.push(...expanded.split(" "));
    else tokens.push(raw);
  }
  return tokens.slice(0, 8);
}

export const SET_TYPES = ["warmup", "working", "drop", "failure"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const SET_TYPE_LABELS: Record<SetType, { short: string; label: string }> = {
  warmup: { short: "W", label: "Warm-up" },
  working: { short: "", label: "Working set" },
  drop: { short: "D", label: "Drop set" },
  failure: { short: "F", label: "To failure" },
};

export function nextSetType(type: SetType): SetType {
  return SET_TYPES[(SET_TYPES.indexOf(type) + 1) % SET_TYPES.length];
}
