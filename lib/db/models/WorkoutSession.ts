import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MUSCLE_GROUPS, SET_TYPES, TRACKING_TYPES } from "@/lib/workouts/taxonomy";
import type { MuscleGroup, SetType, TrackingType } from "@/lib/workouts/taxonomy";
import type { PrKind } from "@/lib/workouts/types";

/**
 * One document per workout actually performed. A session is created when the
 * user presses Start and is never reused: doing the same routine next week
 * creates a new session, so history is never overwritten.
 *
 * All weights are stored in kilograms.
 */
export interface ISessionSet {
  _id: Types.ObjectId;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
  rpe: number | null;
  done: boolean;
  doneAt: Date | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  prKinds: PrKind[];
}

export interface ISessionExercise {
  _id: Types.ObjectId;
  exerciseId: Types.ObjectId;
  name: string;
  primaryMuscle: string;
  muscleGroup: MuscleGroup;
  trackingType: TrackingType;
  unit: "kg" | "lbs";
  restSec: number | null;
  notes: string;
  supersetGroup: number | null;
  metValue: number | null;
  sets: ISessionSet[];
}

export interface ISessionTotals {
  volumeKg: number;
  completedSets: number;
  totalSets: number;
  reps: number;
  calories: number;
  prCount: number;
}

export interface IWorkoutSession {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  routineId: Types.ObjectId | null;
  name: string;
  notes: string;
  status: "in_progress" | "completed";
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  /** The user's time zone when the session was performed. */
  timezone: string;
  /** Calendar day ("YYYY-MM-DD") of the session in that time zone. */
  localDate: string;
  exercises: ISessionExercise[];
  totals: ISessionTotals;
  /** Incremented on every save; lets the server reject stale updates. */
  version: number;
  /** True when the workout was typed in afterwards (no live clock or rest timer). */
  isPastLog: boolean;
  /** Set for sessions converted from the pre-v3 `workouts` collection. */
  legacyWorkoutId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSetSchema = new Schema<ISessionSet>({
  type: { type: String, enum: SET_TYPES, default: "working" },
  weightKg: { type: Number, default: null, min: 0, max: 2000 },
  reps: { type: Number, default: null, min: 0, max: 1000 },
  durationSec: { type: Number, default: null, min: 0, max: 86_400 },
  distanceM: { type: Number, default: null, min: 0, max: 1_000_000 },
  rpe: { type: Number, default: null, min: 1, max: 10 },
  done: { type: Boolean, default: false },
  doneAt: { type: Date, default: null },
  targetRepMin: { type: Number, default: null },
  targetRepMax: { type: Number, default: null },
  targetWeightKg: { type: Number, default: null },
  targetDurationSec: { type: Number, default: null },
  prKinds: { type: [String], default: [] },
});

const SessionExerciseSchema = new Schema<ISessionExercise>({
  exerciseId: { type: Schema.Types.ObjectId, ref: "ExerciseCatalog", required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  primaryMuscle: { type: String, default: "" },
  muscleGroup: { type: String, enum: MUSCLE_GROUPS, default: "other" },
  trackingType: { type: String, enum: TRACKING_TYPES, default: "weight_reps" },
  unit: { type: String, enum: ["kg", "lbs"], default: "kg" },
  restSec: { type: Number, default: null, min: 0, max: 3600 },
  notes: { type: String, default: "", maxlength: 500 },
  supersetGroup: { type: Number, default: null },
  metValue: { type: Number, default: null },
  sets: { type: [SessionSetSchema], default: [] },
});

const WorkoutSessionSchema = new Schema<IWorkoutSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    routineId: { type: Schema.Types.ObjectId, ref: "Routine", default: null },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    notes: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: null, min: 0 },
    timezone: { type: String, required: true },
    localDate: { type: String, required: true },
    exercises: { type: [SessionExerciseSchema], default: [] },
    totals: {
      volumeKg: { type: Number, default: 0 },
      completedSets: { type: Number, default: 0 },
      totalSets: { type: Number, default: 0 },
      reps: { type: Number, default: 0 },
      calories: { type: Number, default: 0 },
      prCount: { type: Number, default: 0 },
    },
    version: { type: Number, default: 0 },
    isPastLog: { type: Boolean, default: false },
    legacyWorkoutId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// At most one workout in progress per user.
WorkoutSessionSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" }, name: "one_in_progress_per_user" }
);
WorkoutSessionSchema.index({ userId: 1, status: 1, endedAt: -1 });
WorkoutSessionSchema.index({ userId: 1, localDate: 1 });
WorkoutSessionSchema.index({ userId: 1, "exercises.exerciseId": 1, endedAt: -1 });
// Cross-user lookups: exercise usage counts and the admin dashboard totals.
WorkoutSessionSchema.index({ "exercises.exerciseId": 1 });
WorkoutSessionSchema.index({ status: 1, endedAt: -1 });
WorkoutSessionSchema.index(
  { legacyWorkoutId: 1 },
  { unique: true, partialFilterExpression: { legacyWorkoutId: { $type: "objectId" } } }
);

const WorkoutSession: Model<IWorkoutSession> =
  (mongoose.models.WorkoutSession as Model<IWorkoutSession>) ||
  mongoose.model<IWorkoutSession>("WorkoutSession", WorkoutSessionSchema);

export default WorkoutSession;
