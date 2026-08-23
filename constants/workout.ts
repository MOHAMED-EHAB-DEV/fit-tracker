import type { DayOfWeek } from "@/lib/db/models/Workout";
import type { IWeeklyRoutineDay } from "@/lib/db/models/User";

export const DAYS_ORDER: DayOfWeek[] = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export interface DayOfWeekItem {
  key: DayOfWeek;
  label: string;
  name: string;
  short: string;
}

export const DAYS_OF_WEEK: DayOfWeekItem[] = [
  { key: "saturday", label: "Saturday", name: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", name: "Sunday", short: "Sun" },
  { key: "monday", label: "Monday", name: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", name: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", name: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", name: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", name: "Friday", short: "Fri" },
];

export const WORKOUT_STATUSES = ["active", "completed", "abandoned"] as const;
export type WorkoutStatusType = (typeof WORKOUT_STATUSES)[number];

export const TEMPLATE_CATEGORIES = [
  "strength",
  "hypertrophy",
  "powerlifting",
  "calisthenics",
] as const;
export type TemplateCategoryType = (typeof TEMPLATE_CATEGORIES)[number];

export const REST_TIMER_PRESETS = ["60", "90", "120", "180"] as const;

export const DEFAULT_WEEKLY_ROUTINE: IWeeklyRoutineDay[] = [
  {
    dayOfWeek: "saturday",
    workoutName: "Push Day (Chest, Shoulders, Triceps)",
    isRestDay: false,
    targetMuscleGroups: ["Chest", "Shoulders", "Arms"],
  },
  {
    dayOfWeek: "sunday",
    workoutName: "Pull Day (Back & Biceps)",
    isRestDay: false,
    targetMuscleGroups: ["Back", "Arms"],
  },
  {
    dayOfWeek: "monday",
    workoutName: "Leg Day (Quads, Hams, Calves)",
    isRestDay: false,
    targetMuscleGroups: ["Legs", "Core"],
  },
  {
    dayOfWeek: "tuesday",
    workoutName: "Rest & Active Recovery",
    isRestDay: true,
    targetMuscleGroups: [],
  },
  {
    dayOfWeek: "wednesday",
    workoutName: "Upper Body Power",
    isRestDay: false,
    targetMuscleGroups: ["Chest", "Back", "Shoulders"],
  },
  {
    dayOfWeek: "thursday",
    workoutName: "Lower Body & Core",
    isRestDay: false,
    targetMuscleGroups: ["Legs", "Core"],
  },
  {
    dayOfWeek: "friday",
    workoutName: "Rest / Active Recovery",
    isRestDay: true,
    targetMuscleGroups: [],
  },
];

export const SPLIT_PRESETS = [
  {
    name: "Push / Pull / Legs (6-Day PPL)",
    tag: "High Volume",
    routine: [
      { day: "saturday" as DayOfWeek, workout: "Push Day (Chest, Shoulders, Triceps)", isRest: false },
      { day: "sunday" as DayOfWeek, workout: "Pull Day (Back, Biceps, Rear Delts)", isRest: false },
      { day: "monday" as DayOfWeek, workout: "Leg Day (Quads, Hamstrings, Calves)", isRest: false },
      { day: "tuesday" as DayOfWeek, workout: "Push Day B (Strength Focus)", isRest: false },
      { day: "wednesday" as DayOfWeek, workout: "Pull Day B (Hypertrophy)", isRest: false },
      { day: "thursday" as DayOfWeek, workout: "Leg Day B (Glutes & Hamstrings)", isRest: false },
      { day: "friday" as DayOfWeek, workout: "Rest & Active Recovery", isRest: true },
    ],
  },
  {
    name: "Upper / Lower (4-Day Split)",
    tag: "Optimal Balance",
    routine: [
      { day: "saturday" as DayOfWeek, workout: "Upper Body Power", isRest: false },
      { day: "sunday" as DayOfWeek, workout: "Lower Body Quad Focus", isRest: false },
      { day: "monday" as DayOfWeek, workout: "Rest & Mobility", isRest: true },
      { day: "tuesday" as DayOfWeek, workout: "Upper Body Hypertrophy", isRest: false },
      { day: "wednesday" as DayOfWeek, workout: "Lower Body Posterior Chain", isRest: false },
      { day: "thursday" as DayOfWeek, workout: "Rest & Core Conditioning", isRest: true },
      { day: "friday" as DayOfWeek, workout: "Rest & Active Recovery", isRest: true },
    ],
  },
  {
    name: "Full Body (3-Day Split)",
    tag: "Time Efficient",
    routine: [
      { day: "saturday" as DayOfWeek, workout: "Full Body Heavy Compound", isRest: false },
      { day: "sunday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
      { day: "monday" as DayOfWeek, workout: "Full Body Hypertrophy", isRest: false },
      { day: "tuesday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
      { day: "wednesday" as DayOfWeek, workout: "Full Body Functional / Calisthenics", isRest: false },
      { day: "thursday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
      { day: "friday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
    ],
  },
  {
    name: "Bodypart Bro Split (5-Day)",
    tag: "Classic Bodybuilding",
    routine: [
      { day: "saturday" as DayOfWeek, workout: "Chest & Abs", isRest: false },
      { day: "sunday" as DayOfWeek, workout: "Back & Traps", isRest: false },
      { day: "monday" as DayOfWeek, workout: "Legs (Quads, Calves)", isRest: false },
      { day: "tuesday" as DayOfWeek, workout: "Shoulders & Rear Delts", isRest: false },
      { day: "wednesday" as DayOfWeek, workout: "Arms (Biceps & Triceps)", isRest: false },
      { day: "thursday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
      { day: "friday" as DayOfWeek, workout: "Rest & Recovery", isRest: true },
    ],
  },
];
