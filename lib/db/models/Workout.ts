import mongoose, { Schema, Document, Model } from "mongoose";

export type DayOfWeek = "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

interface ISet {
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  completedReps: number | null;
  weight: number | null;
  rpe: number | null;
  isWarmup: boolean;
  isPR: boolean;
  completedAt: Date | null;
  restSeconds: number | null;
}

interface IExercise {
  catalogId: mongoose.Types.ObjectId;
  name: string;
  muscleGroup: string;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  warmupSets?: number;
  warmupReps?: number;
  warmupWeight?: number | null;
  sets: ISet[];
  notes: string | null;
  oneRM: number | null;
}

export interface IWorkout extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  dayOfWeek: DayOfWeek;
  templateId: mongoose.Types.ObjectId | null;
  status: "active" | "completed" | "abandoned";
  startedAt: Date;
  completedAt: Date | null;
  durationSeconds: number | null;
  weekStartDate: string; // "YYYY-MM-DD" — Saturday boundary
  exercises: IExercise[];
  weightUnit?: "kg" | "lbs";
  totalVolume: number;
  estimatedCalories: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SetSchema = new Schema<ISet>(
  {
    setNumber: { type: Number, required: true },
    targetReps: { type: Number, default: null },
    targetWeight: { type: Number, default: null },
    completedReps: { type: Number, default: null },
    weight: { type: Number, default: null },
    rpe: { type: Number, default: null, min: 1, max: 10 },
    isWarmup: { type: Boolean, default: false },
    isPR: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    restSeconds: { type: Number, default: null },
  },
  { _id: false }
);

const ExerciseSchema = new Schema<IExercise>(
  {
    catalogId: { type: Schema.Types.ObjectId, ref: "ExerciseCatalog", required: true },
    name: { type: String, required: true },
    muscleGroup: { type: String, required: true },
    weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
    isWarmup: { type: Boolean, default: false },
    warmupSets: { type: Number, default: null },
    warmupReps: { type: Number, default: null },
    warmupWeight: { type: Number, default: null },
    sets: [SetSchema],
    notes: { type: String, default: null },
    oneRM: { type: Number, default: null },
  },
  { _id: false }
);

const WorkoutSchema = new Schema<IWorkout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    dayOfWeek: {
      type: String,
      enum: ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"],
      default: "saturday",
      required: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: "WorkoutTemplate", default: null },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "completed" },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },
    weekStartDate: { type: String, required: true },
    exercises: [ExerciseSchema],
    weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
    totalVolume: { type: Number, default: 0 },
    estimatedCalories: { type: Number, default: 0 },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

WorkoutSchema.index({ userId: 1, dayOfWeek: 1 });
WorkoutSchema.index({ userId: 1, date: -1 });
WorkoutSchema.index({ userId: 1, status: 1 });
WorkoutSchema.index({ userId: 1, "exercises.catalogId": 1, date: -1 });

const Workout: Model<IWorkout> =
  mongoose.models.Workout ||
  mongoose.model<IWorkout>("Workout", WorkoutSchema);

export default Workout;
