export const MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Biceps",
  "Triceps",
  "Legs",
  "Quadriceps",
  "Hamstrings",
  "Calves",
  "Glutes",
  "Core",
  "Abdominals",
  "Lats",
  "Traps",
  "Middle Back",
  "Lower Back",
  "Neck",
  "Forearms",
] as const;

export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_OPTIONS = MUSCLES.map((m) => ({
  value: m,
  label: m,
}));

export const EQUIPMENT_OPTIONS = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "bands",
  "smith_machine",
  "other",
] as const;

export type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

export const EQUIPMENT_LABELS: Record<EquipmentOption, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  bands: "Bands",
  smith_machine: "Smith Machine",
  other: "Other",
};

export const EQUIPMENT_SELECT_OPTIONS = EQUIPMENT_OPTIONS.map((eq) => ({
  value: eq,
  label: EQUIPMENT_LABELS[eq] || eq,
}));

export const CATEGORIES = [
  "strength",
  "cardio",
  "stretching",
  "plyometrics",
  "powerlifting",
  "strongman",
  "olympic_weightlifting",
] as const;

export type ExerciseCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: "Strength",
  cardio: "Cardio",
  stretching: "Stretching & Mobility",
  plyometrics: "Plyometrics",
  powerlifting: "Powerlifting",
  strongman: "Strongman",
  olympic_weightlifting: "Olympic Weightlifting",
};

export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c] || c,
}));

export const EXERCISE_SEARCH_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "strength", label: "Strength" },
  { id: "stretching", label: "Stretches & Mobility" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "cardio", label: "Cardio" },
  { id: "plyometrics", label: "Plyometrics" },
] as const;

export const LEVELS = ["beginner", "intermediate", "expert"] as const;
export type ExerciseLevel = (typeof LEVELS)[number];
export const LEVEL_OPTIONS = LEVELS.map((l) => ({
  value: l,
  label: l.charAt(0).toUpperCase() + l.slice(1),
}));

export const FORCES = ["push", "pull", "static"] as const;
export type ExerciseForce = (typeof FORCES)[number];
export const FORCE_OPTIONS = FORCES.map((f) => ({
  value: f,
  label: f.charAt(0).toUpperCase() + f.slice(1),
}));

export const MECHANICS = ["compound", "isolation"] as const;
export type ExerciseMechanic = (typeof MECHANICS)[number];
export const MECHANIC_OPTIONS = MECHANICS.map((m) => ({
  value: m,
  label: m.charAt(0).toUpperCase() + m.slice(1),
}));
