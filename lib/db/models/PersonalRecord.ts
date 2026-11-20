import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { PrKind } from "@/lib/workouts/types";

/**
 * The user's current best for an exercise, one document per record kind.
 * Rebuilt from sessions whenever a session is finished, edited or deleted,
 * so it can never drift from the history it summarises.
 */
export interface IPersonalRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  exerciseId: Types.ObjectId;
  exerciseName: string;
  kind: PrKind;
  /** e1rm/weight/volume in kg, reps as a count, duration in seconds, distance in metres. */
  value: number;
  weightKg: number | null;
  reps: number | null;
  sessionId: Types.ObjectId;
  achievedAt: Date;
}

const PersonalRecordSchema = new Schema<IPersonalRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: "ExerciseCatalog", required: true },
    exerciseName: { type: String, default: "" },
    kind: { type: String, enum: ["e1rm", "weight", "reps", "volume", "duration", "distance"], required: true },
    value: { type: Number, required: true },
    weightKg: { type: Number, default: null },
    reps: { type: Number, default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: "WorkoutSession", required: true },
    achievedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

PersonalRecordSchema.index({ userId: 1, exerciseId: 1, kind: 1 }, { unique: true });
PersonalRecordSchema.index({ userId: 1, achievedAt: -1 });

const PersonalRecord: Model<IPersonalRecord> =
  (mongoose.models.PersonalRecord as Model<IPersonalRecord>) ||
  mongoose.model<IPersonalRecord>("PersonalRecord", PersonalRecordSchema);

export default PersonalRecord;
