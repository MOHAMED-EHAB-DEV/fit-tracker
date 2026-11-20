import type { MuscleGroup, SetType, TrackingType } from "@/lib/workouts/taxonomy";
import type { WeightUnit } from "@/lib/fitness/units";

/**
 * Plain (JSON-safe) shapes shared by the API and the browser.
 * All weights are kilograms; `unit` is only how the user likes to see them.
 */

export interface RoutineSetDTO {
  type: SetType;
  repMin: number | null;
  repMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  targetRpe: number | null;
}

export interface RoutineExerciseDTO {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  trackingType: TrackingType;
  unit: WeightUnit;
  restSec: number | null;
  notes: string;
  supersetGroup: number | null;
  sets: RoutineSetDTO[];
}

export interface RoutineDTO {
  id: string;
  name: string;
  notes: string;
  exercises: RoutineExerciseDTO[];
  lastPerformedAt: string | null;
  timesPerformed: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineSummaryDTO {
  id: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  muscleGroups: MuscleGroup[];
  exerciseNames: string[];
  lastPerformedAt: string | null;
  timesPerformed: number;
  updatedAt: string;
}

export type PrKind = "e1rm" | "weight" | "reps" | "volume" | "duration" | "distance";

export interface SessionSetDTO {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  rpe: number | null;
  done: boolean;
  doneAt: string | null;
  /** Targets copied from the routine when the session started. */
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  prKinds: PrKind[];
}

export interface SessionExerciseDTO {
  id: string;
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  trackingType: TrackingType;
  unit: WeightUnit;
  restSec: number | null;
  notes: string;
  supersetGroup: number | null;
  sets: SessionSetDTO[];
}

export interface SessionTotalsDTO {
  volumeKg: number;
  completedSets: number;
  totalSets: number;
  reps: number;
  calories: number;
  prCount: number;
}

export interface SessionDTO {
  id: string;
  routineId: string | null;
  name: string;
  notes: string;
  status: "in_progress" | "completed";
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  localDate: string;
  exercises: SessionExerciseDTO[];
  totals: SessionTotalsDTO;
  version: number;
  /** True when the workout is being typed in afterwards instead of tracked live. */
  isPastLog: boolean;
}

export interface SessionSummaryDTO {
  id: string;
  routineId: string | null;
  name: string;
  status: "in_progress" | "completed";
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  localDate: string;
  exerciseCount: number;
  exerciseNames: string[];
  muscleGroups: MuscleGroup[];
  totals: SessionTotalsDTO;
  isPastLog: boolean;
}

/** What the user did for an exercise the last time they performed it. */
export interface PreviousPerformanceDTO {
  exerciseId: string;
  sessionId: string;
  performedAt: string;
  sets: Array<{
    type: SetType;
    weightKg: number | null;
    reps: number | null;
    durationSec: number | null;
    distanceM: number | null;
    rpe: number | null;
  }>;
}

export interface PersonalRecordDTO {
  exerciseId: string;
  exerciseName: string;
  kind: PrKind;
  value: number;
  weightKg: number | null;
  reps: number | null;
  sessionId: string;
  achievedAt: string;
}

export interface ExerciseDTO {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  muscleGroup: MuscleGroup;
  equipment: string;
  category: string;
  trackingType: TrackingType;
  level: string | null;
  force: string | null;
  mechanic: string | null;
  isCustom: boolean;
  image: string | null;
  images?: string[];
  instructions?: string[];
}

export interface WeeklyScheduleDayDTO {
  dayOfWeek: string;
  routineId: string | null;
  routineName: string | null;
  isRestDay: boolean;
}
