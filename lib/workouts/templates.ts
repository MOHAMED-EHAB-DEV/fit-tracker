import type { SetType } from "@/lib/workouts/taxonomy";

/**
 * Built-in starter routines. Exercises are referenced by catalog name, with
 * alternatives in order of preference; a name that is not in the catalog is
 * skipped rather than failing the whole template.
 */
export interface TemplateExercise {
  names: string[];
  sets: number;
  repMin: number | null;
  repMax: number | null;
  /** For timed exercises (planks, holds). */
  durationSec?: number;
  restSec: number;
  setType?: SetType;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  focus: "strength" | "hypertrophy" | "general";
  daysPerWeek: number;
  exercises: TemplateExercise[];
}

const ex = (
  names: string[],
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number
): TemplateExercise => ({ names, sets, repMin, repMax, restSec });

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "push-hypertrophy",
    name: "Push Day",
    description: "Chest, shoulders and triceps. Part of a push / pull / legs split.",
    focus: "hypertrophy",
    daysPerWeek: 3,
    exercises: [
      ex(["Barbell Bench Press", "Barbell Bench Press - Medium Grip", "Dumbbell Bench Press"], 4, 8, 10, 120),
      ex(["Incline Dumbbell Press"], 3, 10, 12, 90),
      ex(["Overhead Press", "Barbell Shoulder Press", "Dumbbell Shoulder Press"], 3, 8, 10, 120),
      ex(["Dumbbell Lateral Raise", "Side Lateral Raise"], 4, 12, 15, 60),
      ex(["Tricep Rope Pushdown", "Triceps Pushdown - Rope Attachment", "Triceps Pushdown"], 3, 12, 15, 60),
    ],
  },
  {
    id: "pull-hypertrophy",
    name: "Pull Day",
    description: "Back, rear delts and biceps. Part of a push / pull / legs split.",
    focus: "hypertrophy",
    daysPerWeek: 3,
    exercises: [
      ex(["Lat Pulldown", "Wide-Grip Lat Pulldown", "Pull-Up", "Pullups"], 4, 8, 10, 120),
      ex(["Bent Over Barbell Row", "Bent Over Two-Dumbbell Row"], 4, 8, 10, 120),
      ex(["Seated Cable Row", "Seated Cable Rows"], 3, 10, 12, 90),
      ex(["Face Pull"], 4, 12, 15, 60),
      ex(["Incline Dumbbell Curl", "Dumbbell Bicep Curl", "Barbell Curl"], 3, 10, 12, 60),
    ],
  },
  {
    id: "legs-hypertrophy",
    name: "Leg Day",
    description: "Quads, hamstrings and calves. Part of a push / pull / legs split.",
    focus: "hypertrophy",
    daysPerWeek: 3,
    exercises: [
      ex(["Barbell Back Squat", "Barbell Squat"], 4, 8, 10, 150),
      ex(["Romanian Deadlift"], 3, 10, 12, 120),
      ex(["Leg Press"], 3, 10, 12, 120),
      ex(["Seated Leg Curl", "Lying Leg Curls"], 3, 12, 15, 75),
      ex(["Standing Calf Raise", "Seated Calf Raise"], 4, 15, 20, 60),
    ],
  },
  {
    id: "upper-strength",
    name: "Upper Body Strength",
    description: "Heavy compound lifts for the upper body. Pair with Lower Body Strength.",
    focus: "strength",
    daysPerWeek: 4,
    exercises: [
      ex(["Barbell Bench Press", "Barbell Bench Press - Medium Grip"], 5, 5, 5, 180),
      ex(["Bent Over Barbell Row"], 5, 5, 5, 180),
      ex(["Overhead Press", "Barbell Shoulder Press"], 4, 6, 6, 150),
      ex(["Pull-Up", "Pullups", "Chin-Up", "Lat Pulldown"], 3, 6, 8, 120),
      ex(["Close-Grip Barbell Bench Press"], 3, 8, 8, 120),
    ],
  },
  {
    id: "lower-strength",
    name: "Lower Body Strength",
    description: "Squat, deadlift and core. Pair with Upper Body Strength.",
    focus: "strength",
    daysPerWeek: 4,
    exercises: [
      ex(["Barbell Back Squat", "Barbell Squat"], 5, 5, 5, 180),
      ex(["Barbell Deadlift"], 3, 5, 5, 180),
      ex(["Dumbbell Lunges", "Barbell Lunge"], 3, 8, 10, 120),
      ex(["Hanging Leg Raise"], 3, 12, 15, 60),
      ex(["Ab Roller", "Cable Crunch"], 3, 10, 12, 60),
    ],
  },
  {
    id: "full-body",
    name: "Full Body",
    description: "One session that covers everything. Do it three times a week.",
    focus: "general",
    daysPerWeek: 3,
    exercises: [
      ex(["Barbell Squat", "Barbell Back Squat", "Leg Press"], 3, 8, 10, 150),
      ex(["Dumbbell Bench Press", "Barbell Bench Press"], 3, 8, 10, 120),
      ex(["Lat Pulldown", "Seated Cable Row"], 3, 10, 12, 90),
      ex(["Dumbbell Shoulder Press"], 3, 10, 12, 90),
      ex(["Romanian Deadlift"], 3, 10, 12, 120),
      { names: ["Plank"], sets: 3, repMin: null, repMax: null, durationSec: 45, restSec: 45 },
    ],
  },
];

export function findTemplate(templateId: string): WorkoutTemplate | undefined {
  return WORKOUT_TEMPLATES.find((template) => template.id === templateId);
}
