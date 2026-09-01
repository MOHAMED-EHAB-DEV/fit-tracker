import mongoose, { Schema, Document, Model } from "mongoose";

interface ICloudinaryMeta {
  publicId: string;
  secureUrl: string;
  deliveryType: "upload" | "private";
  width: number;
  height: number;
  bytes: number;
}

interface IAiMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "high" | "medium" | "low";
  confidenceReason?: string;
  geminiNotes: string;
  modelUsed: string;
}

export interface IMeal extends Document {
  userId: mongoose.Types.ObjectId;
  loggedAt: Date;
  dateString: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "post_workout";
  description: string;
  imageSource: "photo" | "text_only";
  cloudinary: ICloudinaryMeta | null;
  aiMacros: IAiMacros | null;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  isManualOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MealSchema = new Schema<IMeal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    loggedAt: { type: Date, required: true },
    dateString: { type: String, required: true },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"],
      required: true,
    },
    description: { type: String, default: "" },
    imageSource: { type: String, enum: ["photo", "text_only"], default: "text_only" },
    cloudinary: {
      type: {
        publicId: String,
        secureUrl: String,
        deliveryType: { type: String, enum: ["upload", "private"] },
        width: Number,
        height: Number,
        bytes: Number,
      },
      default: null,
    },
    aiMacros: {
      type: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fat: Number,
        fiber: Number,
        confidence: { type: String, enum: ["high", "medium", "low"] },
        confidenceReason: String,
        geminiNotes: String,
        modelUsed: String,
      },
      default: null,
    },
    macros: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
    },
    isManualOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MealSchema.index({ userId: 1, loggedAt: -1 });
MealSchema.index({ userId: 1, dateString: 1 });

const Meal: Model<IMeal> =
  mongoose.models.Meal || mongoose.model<IMeal>("Meal", MealSchema);

export default Meal;
