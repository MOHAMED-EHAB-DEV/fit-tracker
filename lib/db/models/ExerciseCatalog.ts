import mongoose, { Schema, Document, Model } from "mongoose";
import {
  MUSCLE_GROUPS,
  TRACKING_TYPES,
  muscleGroupOf,
  normalizeExerciseName,
  trackingTypeOf,
  type MuscleGroup,
  type TrackingType,
} from "@/lib/workouts/taxonomy";

export interface IExerciseCatalog extends Document {
  name: string;
  /** Lower-cased, punctuation-free name used for search and duplicate checks. */
  normalizedName: string;
  slug: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  muscleGroup: MuscleGroup;
  equipment: string;
  category: string;
  trackingType: TrackingType;
  force?: "pull" | "push" | "static" | null;
  level?: "beginner" | "intermediate" | "expert" | null;
  mechanic?: "compound" | "isolation" | null;
  instructions?: string[];
  images?: string[];
  metValue: number;
  isCustom: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  /** Soft delete: archived exercises stay readable in history but cannot be added. */
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseCatalogSchema = new Schema<IExerciseCatalog>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedName: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, lowercase: true },
    primaryMuscle: { type: String, required: true, trim: true },
    secondaryMuscles: [{ type: String }],
    muscleGroup: { type: String, enum: MUSCLE_GROUPS, default: "other" },
    equipment: { type: String, default: "other", required: true },
    category: { type: String, default: "strength", required: true },
    // No default on purpose: when it is not chosen explicitly it is derived below.
    trackingType: { type: String, enum: TRACKING_TYPES },
    force: { type: String, default: null },
    level: { type: String, default: null },
    mechanic: { type: String, default: null },
    instructions: [{ type: String }],
    images: [{ type: String }],
    metValue: { type: Number, default: 5.0, min: 1, max: 20 },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Keep the derived fields in step with the source fields on every save.
ExerciseCatalogSchema.pre("validate", function () {
  this.normalizedName = normalizeExerciseName(this.name || "");
  this.muscleGroup = muscleGroupOf(this.primaryMuscle, this.category);
  if (!this.trackingType) this.trackingType = trackingTypeOf(this);
});

ExerciseCatalogSchema.index({ primaryMuscle: 1 });
ExerciseCatalogSchema.index({ category: 1 });
ExerciseCatalogSchema.index({ name: "text" });
ExerciseCatalogSchema.index({ isCustom: 1, createdBy: 1 });
ExerciseCatalogSchema.index({ normalizedName: 1 });

const ExerciseCatalog: Model<IExerciseCatalog> =
  mongoose.models.ExerciseCatalog ||
  mongoose.model<IExerciseCatalog>("ExerciseCatalog", ExerciseCatalogSchema);

export default ExerciseCatalog;

/**
 * Tracking type and muscle group for a catalog entry, working for records
 * saved before those fields existed.
 */
export function resolveExerciseMeta(exercise: {
  name?: string | null;
  primaryMuscle?: string | null;
  equipment?: string | null;
  category?: string | null;
  trackingType?: string | null;
  muscleGroup?: string | null;
  normalizedName?: string | null;
}): { trackingType: TrackingType; muscleGroup: MuscleGroup } {
  const derivedFieldsStored = Boolean(exercise.normalizedName);
  const trackingType =
    derivedFieldsStored && (TRACKING_TYPES as readonly string[]).includes(exercise.trackingType || "")
      ? (exercise.trackingType as TrackingType)
      : trackingTypeOf(exercise);
  return { trackingType, muscleGroup: muscleGroupOf(exercise.primaryMuscle, exercise.category) };
}
