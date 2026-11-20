import type { IRoutine, IRoutineExercise } from "@/lib/db/models/Routine";
import type { ISessionExercise, IWorkoutSession } from "@/lib/db/models/WorkoutSession";
import type { MuscleGroup } from "@/lib/workouts/taxonomy";
import type {
  RoutineDTO,
  RoutineExerciseDTO,
  RoutineSummaryDTO,
  SessionDTO,
  SessionExerciseDTO,
  SessionSummaryDTO,
  SessionTotalsDTO,
} from "@/lib/workouts/types";

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

function uniqueGroups(exercises: Array<{ muscleGroup: MuscleGroup }>): MuscleGroup[] {
  return Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup).filter(Boolean)));
}

export function toRoutineExerciseDTO(exercise: IRoutineExercise): RoutineExerciseDTO {
  return {
    id: String(exercise._id),
    exerciseId: String(exercise.exerciseId),
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle || "",
    muscleGroup: exercise.muscleGroup || "other",
    trackingType: exercise.trackingType || "weight_reps",
    unit: exercise.unit === "lbs" ? "lbs" : "kg",
    restSec: exercise.restSec ?? null,
    notes: exercise.notes || "",
    supersetGroup: exercise.supersetGroup ?? null,
    sets: (exercise.sets || []).map((set) => ({
      type: set.type || "working",
      repMin: set.repMin ?? null,
      repMax: set.repMax ?? null,
      targetWeightKg: set.targetWeightKg ?? null,
      targetDurationSec: set.targetDurationSec ?? null,
      targetRpe: set.targetRpe ?? null,
    })),
  };
}

export function toRoutineDTO(routine: IRoutine): RoutineDTO {
  return {
    id: String(routine._id),
    name: routine.name,
    notes: routine.notes || "",
    exercises: (routine.exercises || []).map(toRoutineExerciseDTO),
    lastPerformedAt: iso(routine.lastPerformedAt),
    timesPerformed: routine.timesPerformed || 0,
    createdAt: iso(routine.createdAt) as string,
    updatedAt: iso(routine.updatedAt) as string,
  };
}

export function toRoutineSummaryDTO(routine: IRoutine): RoutineSummaryDTO {
  const exercises = routine.exercises || [];
  return {
    id: String(routine._id),
    name: routine.name,
    exerciseCount: exercises.length,
    setCount: exercises.reduce((sum, exercise) => sum + (exercise.sets?.length || 0), 0),
    muscleGroups: uniqueGroups(exercises),
    exerciseNames: exercises.map((exercise) => exercise.name),
    lastPerformedAt: iso(routine.lastPerformedAt),
    timesPerformed: routine.timesPerformed || 0,
    updatedAt: iso(routine.updatedAt) as string,
  };
}

function toTotals(session: IWorkoutSession): SessionTotalsDTO {
  return {
    volumeKg: session.totals?.volumeKg || 0,
    completedSets: session.totals?.completedSets || 0,
    totalSets: session.totals?.totalSets || 0,
    reps: session.totals?.reps || 0,
    calories: session.totals?.calories || 0,
    prCount: session.totals?.prCount || 0,
  };
}

export function toSessionExerciseDTO(exercise: ISessionExercise): SessionExerciseDTO {
  return {
    id: String(exercise._id),
    exerciseId: String(exercise.exerciseId),
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle || "",
    muscleGroup: exercise.muscleGroup || "other",
    trackingType: exercise.trackingType || "weight_reps",
    unit: exercise.unit === "lbs" ? "lbs" : "kg",
    restSec: exercise.restSec ?? null,
    notes: exercise.notes || "",
    supersetGroup: exercise.supersetGroup ?? null,
    sets: (exercise.sets || []).map((set) => ({
      id: String(set._id),
      type: set.type || "working",
      weightKg: set.weightKg ?? null,
      reps: set.reps ?? null,
      durationSec: set.durationSec ?? null,
      distanceM: set.distanceM ?? null,
      rpe: set.rpe ?? null,
      done: Boolean(set.done),
      doneAt: iso(set.doneAt),
      targetRepMin: set.targetRepMin ?? null,
      targetRepMax: set.targetRepMax ?? null,
      targetWeightKg: set.targetWeightKg ?? null,
      targetDurationSec: set.targetDurationSec ?? null,
      prKinds: set.prKinds || [],
    })),
  };
}

export function toSessionDTO(session: IWorkoutSession): SessionDTO {
  return {
    id: String(session._id),
    routineId: session.routineId ? String(session.routineId) : null,
    name: session.name,
    notes: session.notes || "",
    status: session.status,
    startedAt: iso(session.startedAt) as string,
    endedAt: iso(session.endedAt),
    durationSec: session.durationSec ?? null,
    localDate: session.localDate,
    exercises: (session.exercises || []).map(toSessionExerciseDTO),
    totals: toTotals(session),
    version: session.version || 0,
    isPastLog: Boolean(session.isPastLog),
  };
}

export function toSessionSummaryDTO(session: IWorkoutSession): SessionSummaryDTO {
  const exercises = session.exercises || [];
  return {
    id: String(session._id),
    routineId: session.routineId ? String(session.routineId) : null,
    name: session.name,
    status: session.status,
    startedAt: iso(session.startedAt) as string,
    endedAt: iso(session.endedAt),
    durationSec: session.durationSec ?? null,
    localDate: session.localDate,
    exerciseCount: exercises.length,
    exerciseNames: exercises.map((exercise) => exercise.name),
    muscleGroups: uniqueGroups(exercises),
    totals: toTotals(session),
    isPastLog: Boolean(session.isPastLog),
  };
}
