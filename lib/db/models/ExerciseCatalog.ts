import mongoose, { Schema, Document, Model } from "mongoose";

export interface IExerciseCatalog extends Document {
  name: string;
  slug: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  force?: "pull" | "push" | "static" | null;
  level?: "beginner" | "intermediate" | "expert" | null;
  mechanic?: "compound" | "isolation" | null;
  instructions?: string[];
  images?: string[];
  metValue: number;
  isCustom: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const ExerciseCatalogSchema = new Schema<IExerciseCatalog>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    primaryMuscle: { type: String, required: true },
    secondaryMuscles: [{ type: String }],
    equipment: {
      type: String,
      default: "other",
      required: true,
    },
    category: {
      type: String,
      default: "strength",
      required: true,
    },
    force: { type: String, default: null },
    level: { type: String, default: null },
    mechanic: { type: String, default: null },
    instructions: [{ type: String }],
    images: [{ type: String }],
    metValue: { type: Number, default: 5.0 },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ExerciseCatalogSchema.index({ primaryMuscle: 1 });
ExerciseCatalogSchema.index({ category: 1 });
ExerciseCatalogSchema.index({ name: "text" });

const ExerciseCatalog: Model<IExerciseCatalog> =
  mongoose.models.ExerciseCatalog ||
  mongoose.model<IExerciseCatalog>("ExerciseCatalog", ExerciseCatalogSchema);

export default ExerciseCatalog;
