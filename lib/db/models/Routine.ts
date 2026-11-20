import mongoose, { Schema, type Model, type Types } from "mongoose";
import { MUSCLE_GROUPS, SET_TYPES, TRACKING_TYPES } from "@/lib/workouts/taxonomy";
import type { MuscleGroup, SetType, TrackingType } from "@/lib/workouts/taxonomy";

/**
 * A routine is a PLAN: which exercises, how many sets, what to aim for.
 * It never holds performed data — that lives in WorkoutSession, one document
 * per workout actually done.
 */
export interface IRoutineSet {
  type: SetType;
  repMin: number | null;
  repMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  targetRpe: number | null;
}

export interface IRoutineExercise {
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
  sets: IRoutineSet[];
}

export interface IRoutine {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  notes: string;
  exercises: IRoutineExercise[];
  lastPerformedAt: Date | null;
  timesPerformed: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RoutineSetSchema = new Schema<IRoutineSet>(
  {
    type: { type: String, enum: SET_TYPES, default: "working" },
    repMin: { type: Number, default: null, min: 0, max: 1000 },
    repMax: { type: Number, default: null, min: 0, max: 1000 },
    targetWeightKg: { type: Number, default: null, min: 0, max: 2000 },
    targetDurationSec: { type: Number, default: null, min: 0, max: 86_400 },
    targetRpe: { type: Number, default: null, min: 1, max: 10 },
  },
  { _id: false }
);

const RoutineExerciseSchema = new Schema<IRoutineExercise>({
  exerciseId: { type: Schema.Types.ObjectId, ref: "ExerciseCatalog", required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  primaryMuscle: { type: String, default: "" },
  muscleGroup: { type: String, enum: MUSCLE_GROUPS, default: "other" },
  trackingType: { type: String, enum: TRACKING_TYPES, default: "weight_reps" },
  unit: { type: String, enum: ["kg", "lbs"], default: "kg" },
  restSec: { type: Number, default: null, min: 0, max: 3600 },
  notes: { type: String, default: "", maxlength: 500 },
  supersetGroup: { type: Number, default: null },
  sets: { type: [RoutineSetSchema], default: [] },
});

const RoutineSchema = new Schema<IRoutine>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    notes: { type: String, default: "", maxlength: 1000 },
    exercises: { type: [RoutineExerciseSchema], default: [] },
    lastPerformedAt: { type: Date, default: null },
    timesPerformed: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RoutineSchema.index({ userId: 1, archivedAt: 1, updatedAt: -1 });
// "Where is this exercise used?" (admin, before archiving an exercise).
RoutineSchema.index({ "exercises.exerciseId": 1 });

const Routine: Model<IRoutine> =
  (mongoose.models.Routine as Model<IRoutine>) || mongoose.model<IRoutine>("Routine", RoutineSchema);

export default Routine;
