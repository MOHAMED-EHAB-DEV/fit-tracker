import mongoose, { Schema, Document, Model } from "mongoose";

interface IBodyPhoto {
  cloudinaryPublicId: string;
  angle: "front" | "side" | "back";
  signedUrl: string; // Regenerated server-side on each GET (expires quickly)
  urlExpiresAt: Date;
}

interface IAiAnalysis {
  qualitativeNotes: string;
  estimatedBodyFatPercent?: number | null;
  estimatedBodyFatRange: string;
  comparedToPrevious: string;
  muscleGroupHighlights: string[];
  recommendations: string[];
  modelUsed: string;
  generatedAt: Date;
}

export interface IBodyComp extends Document {
  userId: mongoose.Types.ObjectId;
  checkInDate: Date;
  dateString: string;
  weight: number | null;
  bodyFatPercent: number | null;
  measurements: {
    chest: number | null;
    waist: number | null;
    hips: number | null;
    arms: number | null;
    thighs: number | null;
  } | null;
  photos: IBodyPhoto[];
  aiAnalysis: IAiAnalysis | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BodyCompSchema = new Schema<IBodyComp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    checkInDate: { type: Date, required: true },
    dateString: { type: String, required: true },
    weight: { type: Number, default: null },
    bodyFatPercent: { type: Number, default: null },
    measurements: {
      type: {
        chest: { type: Number, default: null },
        waist: { type: Number, default: null },
        hips: { type: Number, default: null },
        arms: { type: Number, default: null },
        thighs: { type: Number, default: null },
      },
      default: null,
    },
    photos: [
      {
        cloudinaryPublicId: String,
        angle: { type: String, enum: ["front", "side", "back"] },
        signedUrl: String,
        urlExpiresAt: Date,
        _id: false,
      },
    ],
    aiAnalysis: {
      type: {
        qualitativeNotes: String,
        estimatedBodyFatPercent: { type: Number, default: null },
        estimatedBodyFatRange: String,
        comparedToPrevious: String,
        muscleGroupHighlights: [String],
        recommendations: [String],
        modelUsed: String,
        generatedAt: Date,
      },
      default: null,
    },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

BodyCompSchema.index({ userId: 1, checkInDate: -1 });

const BodyComp: Model<IBodyComp> =
  mongoose.models.BodyComp ||
  mongoose.model<IBodyComp>("BodyComp", BodyCompSchema);

export default BodyComp;
