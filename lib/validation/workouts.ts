import { z } from "zod";
import { boundedInt, boundedNumber, objectId, weekdayKey, weightUnit } from "@/lib/validation/common";
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLE_GROUPS, PRIMARY_MUSCLES, SET_TYPES, TRACKING_TYPES } from "@/lib/workouts/taxonomy";

const setType = z.enum(SET_TYPES);
const isoDate = z.string().datetime({ offset: true });

const nullableInt = (min: number, max: number) => boundedInt(min, max).nullable().optional().default(null);
const nullableNumber = (min: number, max: number) => boundedNumber(min, max).nullable().optional().default(null);

// ----- Routines -------------------------------------------------------------

export const routineSetSchema = z.object({
  type: setType.optional().default("working"),
  repMin: nullableInt(0, 1000),
  repMax: nullableInt(0, 1000),
  targetWeightKg: nullableNumber(0, 2000),
  targetDurationSec: nullableInt(0, 86_400),
  targetRpe: nullableNumber(1, 10),
});

export const routineExerciseSchema = z.object({
  id: objectId.optional(),
  exerciseId: objectId,
  unit: weightUnit.optional(),
  restSec: nullableInt(0, 3600),
  notes: z.string().trim().max(500).optional().default(""),
  supersetGroup: nullableInt(1, 50),
  sets: z.array(routineSetSchema).max(30),
});

export const routineCreateSchema = z.object({
  name: z.string().trim().min(1, "Give the routine a name").max(80),
  notes: z.string().trim().max(1000).optional(),
  exercises: z.array(routineExerciseSchema).max(40).optional(),
  /** Create from a built-in template. */
  templateId: z.string().max(60).optional(),
  /** Create from a finished session ("save as routine"). */
  fromSessionId: objectId.optional(),
});

export const routineUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  exercises: z.array(routineExerciseSchema).max(40).optional(),
});

// ----- Sessions -------------------------------------------------------------

export const sessionSetSchema = z.object({
  id: objectId.optional(),
  type: setType.optional().default("working"),
  weightKg: nullableNumber(0, 2000),
  reps: nullableInt(0, 1000),
  durationSec: nullableInt(0, 86_400),
  distanceM: nullableNumber(0, 1_000_000),
  rpe: nullableNumber(1, 10),
  done: z.boolean().optional().default(false),
  doneAt: isoDate.nullable().optional().default(null),
  targetRepMin: nullableInt(0, 1000),
  targetRepMax: nullableInt(0, 1000),
  targetWeightKg: nullableNumber(0, 2000),
  targetDurationSec: nullableInt(0, 86_400),
});

export const sessionExerciseSchema = z.object({
  id: objectId.optional(),
  exerciseId: objectId,
  unit: weightUnit.optional(),
  restSec: nullableInt(0, 3600),
  notes: z.string().trim().max(500).optional().default(""),
  supersetGroup: nullableInt(1, 50),
  sets: z.array(sessionSetSchema).max(40),
});

export const sessionStartSchema = z.object({
  routineId: objectId.optional(),
  /** Start a new session with the same exercises as a past one. */
  repeatSessionId: objectId.optional(),
  name: z.string().trim().max(80).optional(),
  /** Only for logging a workout that already happened. */
  startedAt: isoDate.optional(),
});

export const sessionSaveSchema = z.object({
  version: boundedInt(0, 1_000_000),
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  exercises: z.array(sessionExerciseSchema).max(40).optional(),
  startedAt: isoDate.optional(),
  /** For completed sessions and past workouts: how long it took. */
  durationSec: boundedInt(0, 86_400).optional(),
});

export const sessionFinishSchema = sessionSaveSchema.extend({
  endedAt: isoDate.optional(),
});

export const sessionListQuerySchema = z.object({
  cursor: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  exerciseId: objectId.optional(),
});

// ----- Exercises ------------------------------------------------------------

export const customExerciseSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  primaryMuscle: z.enum(PRIMARY_MUSCLES),
  secondaryMuscles: z.array(z.enum(PRIMARY_MUSCLES)).max(6).optional().default([]),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(EXERCISE_CATEGORIES).optional().default("strength"),
  trackingType: z.enum(TRACKING_TYPES).optional(),
  instructions: z.array(z.string().trim().min(1).max(500)).max(15).optional().default([]),
});

export const customExerciseUpdateSchema = customExerciseSchema.partial();

export const exerciseFilterSchema = z.object({
  muscleGroup: z.enum(MUSCLE_GROUPS).optional(),
});

// ----- Weekly schedule ------------------------------------------------------

export const weeklyScheduleSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: weekdayKey,
        routineId: objectId.nullable(),
        isRestDay: z.boolean(),
      })
    )
    .length(7)
    .refine((days) => new Set(days.map((day) => day.dayOfWeek)).size === 7, "Each weekday must appear once"),
});

export type RoutineExerciseInput = z.infer<typeof routineExerciseSchema>;
export type SessionExerciseInput = z.infer<typeof sessionExerciseSchema>;
export type SessionSaveInput = z.infer<typeof sessionSaveSchema>;
export type SessionFinishInput = z.infer<typeof sessionFinishSchema>;
