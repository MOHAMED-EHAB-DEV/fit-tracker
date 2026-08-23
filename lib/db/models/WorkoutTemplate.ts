import mongoose, { Schema, Document, Model } from "mongoose";

interface ITemplateExercise {
  catalogId: mongoose.Types.ObjectId;
  name: string;
  sets: number;
  repRange: string; // e.g. "8-12"
}

export interface IWorkoutTemplate extends Document {
  createdBy: mongoose.Types.ObjectId | null;
  name: string;
  description: string;
  category: "strength" | "hypertrophy" | "powerlifting" | "calisthenics";
  dayOfWeek?: "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | null;
  daysPerWeek: number;
  exercises: ITemplateExercise[];
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
}

const WorkoutTemplateSchema = new Schema<IWorkoutTemplate>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: {
      type: String,
      enum: ["strength", "hypertrophy", "powerlifting", "calisthenics"],
      required: true,
    },
    dayOfWeek: {
      type: String,
      enum: ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", null],
      default: null,
    },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    exercises: [
      {
        catalogId: { type: Schema.Types.ObjectId, ref: "ExerciseCatalog", required: true },
        name: { type: String, required: true },
        sets: { type: Number, required: true },
        repRange: { type: String, required: true },
        _id: false,
      },
    ],
    isPublic: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WorkoutTemplateSchema.index({ isPublic: 1, usageCount: -1 });
WorkoutTemplateSchema.index({ createdBy: 1 });
WorkoutTemplateSchema.index({ dayOfWeek: 1 });

const WorkoutTemplate: Model<IWorkoutTemplate> =
  mongoose.models.WorkoutTemplate ||
  mongoose.model<IWorkoutTemplate>("WorkoutTemplate", WorkoutTemplateSchema);

export default WorkoutTemplate;
