export interface ICuratedTemplateExercise {
  name: string;
  muscleGroup: string;
  sets: number;
  repRange: string;
}

export interface ICuratedTemplate {
  _id: string;
  name: string;
  description: string;
  category: "strength" | "hypertrophy" | "powerlifting" | "calisthenics";
  dayOfWeek?: string;
  daysPerWeek: number;
  exercises: ICuratedTemplateExercise[];
  isCurated: boolean;
}

export const DEFAULT_WORKOUT_TEMPLATES: ICuratedTemplate[] = [
  {
    _id: "curated-push-hypertrophy",
    name: "Push Day (Chest, Shoulders, Triceps)",
    description: "Classic hypertrophic push session targeting pectoral development, lateral delt capped look, and tricep horseshoe fullness.",
    category: "hypertrophy",
    dayOfWeek: "saturday",
    daysPerWeek: 3,
    isCurated: true,
    exercises: [
      { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 4, repRange: "8-10" },
      { name: "Incline Dumbbell Press", muscleGroup: "Chest", sets: 3, repRange: "10-12" },
      { name: "Overhead Barbell Press", muscleGroup: "Shoulders", sets: 3, repRange: "8-10" },
      { name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", sets: 4, repRange: "12-15" },
      { name: "Tricep Rope Pushdown", muscleGroup: "Arms", sets: 3, repRange: "12-15" },
    ],
  },
  {
    _id: "curated-pull-hypertrophy",
    name: "Pull Day (Back, Rear Delts, Biceps)",
    description: "High-density pulling workout optimizing lat width, rhomboid thickness, and bicep peak contraction.",
    category: "hypertrophy",
    dayOfWeek: "sunday",
    daysPerWeek: 3,
    isCurated: true,
    exercises: [
      { name: "Lat Pulldown / Pull-ups", muscleGroup: "Back", sets: 4, repRange: "8-10" },
      { name: "Bent-over Barbell Row", muscleGroup: "Back", sets: 4, repRange: "8-10" },
      { name: "Seated Cable Row", muscleGroup: "Back", sets: 3, repRange: "10-12" },
      { name: "Face Pulls", muscleGroup: "Shoulders", sets: 4, repRange: "12-15" },
      { name: "Incline Dumbbell Bicep Curl", muscleGroup: "Arms", sets: 3, repRange: "10-12" },
    ],
  },
  {
    _id: "curated-legs-hypertrophy",
    name: "Leg Day (Quads, Hamstrings, Calves)",
    description: "Complete lower-body development split balancing knee-dominant quad drive with hip-hinge hamstring load.",
    category: "hypertrophy",
    dayOfWeek: "monday",
    daysPerWeek: 3,
    isCurated: true,
    exercises: [
      { name: "Barbell Back Squat", muscleGroup: "Legs", sets: 4, repRange: "8-10" },
      { name: "Romanian Deadlift", muscleGroup: "Legs", sets: 3, repRange: "10-12" },
      { name: "Leg Press", muscleGroup: "Legs", sets: 3, repRange: "10-12" },
      { name: "Leg Curl (Seated or Lying)", muscleGroup: "Legs", sets: 3, repRange: "12-15" },
      { name: "Standing Calf Raises", muscleGroup: "Legs", sets: 4, repRange: "15-20" },
    ],
  },
  {
    _id: "curated-upper-power",
    name: "Upper Body Power Split",
    description: "Compound mechanical tension focus prioritizing 1RM progression and explosive upper torso strength.",
    category: "strength",
    dayOfWeek: "wednesday",
    daysPerWeek: 4,
    isCurated: true,
    exercises: [
      { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 5, repRange: "5-5" },
      { name: "Pendlay Barbell Row", muscleGroup: "Back", sets: 5, repRange: "5-5" },
      { name: "Standing Overhead Press", muscleGroup: "Shoulders", sets: 4, repRange: "6-6" },
      { name: "Weighted Pull-ups", muscleGroup: "Back", sets: 3, repRange: "6-8" },
      { name: "Close-Grip Bench Press", muscleGroup: "Arms", sets: 3, repRange: "8-8" },
    ],
  },
  {
    _id: "curated-lower-power",
    name: "Lower Body & Core Strength",
    description: "Posterior chain power generation featuring raw squats, deadlifts, and rotational core stability.",
    category: "strength",
    dayOfWeek: "thursday",
    daysPerWeek: 4,
    isCurated: true,
    exercises: [
      { name: "Barbell Back Squat", muscleGroup: "Legs", sets: 5, repRange: "5-5" },
      { name: "Conventional Deadlift", muscleGroup: "Back", sets: 3, repRange: "5-5" },
      { name: "Bulgarian Split Squat", muscleGroup: "Legs", sets: 3, repRange: "8-10" },
      { name: "Hanging Leg Raises", muscleGroup: "Core", sets: 3, repRange: "12-15" },
      { name: "Ab Wheel Rollout", muscleGroup: "Core", sets: 3, repRange: "10-12" },
    ],
  },
  {
    _id: "curated-full-body-3day",
    name: "Full Body Foundation (3-Day)",
    description: "Time-efficient total body regimen designed for steady progression across all primary kinetic chains.",
    category: "strength",
    dayOfWeek: "saturday",
    daysPerWeek: 3,
    isCurated: true,
    exercises: [
      { name: "Barbell Squat", muscleGroup: "Legs", sets: 3, repRange: "8-10" },
      { name: "Dumbbell Flat Bench Press", muscleGroup: "Chest", sets: 3, repRange: "8-10" },
      { name: "Neutral Grip Lat Pulldown", muscleGroup: "Back", sets: 3, repRange: "10-12" },
      { name: "Dumbbell Overhead Shoulder Press", muscleGroup: "Shoulders", sets: 3, repRange: "10-12" },
      { name: "Romanian Deadlift", muscleGroup: "Legs", sets: 3, repRange: "10-12" },
      { name: "Plank Hold", muscleGroup: "Core", sets: 3, repRange: "45-60s" },
    ],
  },
];
