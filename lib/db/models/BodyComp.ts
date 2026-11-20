import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBodyPhoto {
  /** Cloudinary public id. Photos are delivered only through short-lived signed URLs. */
  cloudinaryPublicId: string;
  angle: "front" | "side" | "back";
  /** Cloudinary delivery type ("private" for every upload since the fix). */
  deliveryType?: "private" | "upload" | "authenticated" | null;
  /** Stored file format (e.g. "webp"); needed to sign download URLs. */
  format?: string | null;
  /**
   * @deprecated Legacy: the upload's secure_url, saved by old versions. Never
   * sent to the browser; only used to recover the public id when missing.
   */
  signedUrl?: string | null;
  /** @deprecated Legacy, unused. */
  urlExpiresAt?: Date | null;
}

export interface IAiAnalysis {
  qualitativeNotes: string;
  estimatedBodyFatPercent?: number | null;
  estimatedBodyFatRange: string;
  comparedToPrevious: string;
  muscleGroupHighlights: string[];
  recommendations: string[];
  modelUsed: string;
  generatedAt: Date;
}

export interface IBodyMeasurements {
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
}

export interface IBodyComp extends Document {
  userId: mongoose.Types.ObjectId;
  checkInDate: Date;
  /** "YYYY-MM-DD" in the user's zone. */
  dateString: string;
  /** Kilograms. */
  weight: number | null;
  /** Measured by the user (the AI estimate lives in aiAnalysis). */
  bodyFatPercent: number | null;
  /** Centimetres. */
  measurements: IBodyMeasurements | null;
  photos: IBodyPhoto[];
  aiAnalysis: IAiAnalysis | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const measurement = { type: Number, default: null, min: 10, max: 300 };

const BodyCompSchema = new Schema<IBodyComp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    checkInDate: { type: Date, required: true },
    dateString: { type: String, required: true },
    weight: { type: Number, default: null, min: 20, max: 400 },
    bodyFatPercent: { type: Number, default: null, min: 0, max: 75 },
    measurements: {
      type: {
        chest: measurement,
        waist: measurement,
        hips: measurement,
        arms: measurement,
        thighs: measurement,
      },
      default: null,
    },
    photos: [
      {
        cloudinaryPublicId: String,
        angle: { type: String, enum: ["front", "side", "back"] },
        deliveryType: { type: String, enum: ["private", "upload", "authenticated"], default: "private" },
        format: { type: String, default: null },
        signedUrl: String,
        urlExpiresAt: Date,
        _id: false,
      },
    ],
    aiAnalysis: {
      type: {
        qualitativeNotes: String,
        estimatedBodyFatPercent: { type: Number, default: null, min: 0, max: 75 },
        estimatedBodyFatRange: String,
        comparedToPrevious: String,
        muscleGroupHighlights: [String],
        recommendations: [String],
        modelUsed: String,
        generatedAt: Date,
      },
      default: null,
    },
    notes: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true }
);

BodyCompSchema.index({ userId: 1, checkInDate: -1 });

const BodyComp: Model<IBodyComp> =
  mongoose.models.BodyComp ||
  mongoose.model<IBodyComp>("BodyComp", BodyCompSchema);

export default BodyComp;
