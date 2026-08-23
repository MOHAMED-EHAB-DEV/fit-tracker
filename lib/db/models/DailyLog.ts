import mongoose, { Schema, Document, Model } from "mongoose";

interface IWaterEntry {
  amount: number;
  loggedAt: Date;
}

export interface IDailyLog extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  dateString: string; // "YYYY-MM-DD" in Africa/Cairo
  caloriesIn: number;
  caloriesOut: {
    bmr: number;
    workouts: number;
    steps: number;
    total: number;
  };
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  waterMl: number;
  waterEntries: IWaterEntry[];
  steps: number;
  stepsSyncedAt: Date | null;
  stepsSource: "step_counter" | "manual";
  createdAt: Date;
  updatedAt: Date;
}

const DailyLogSchema = new Schema<IDailyLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    dateString: { type: String, required: true },
    caloriesIn: { type: Number, default: 0 },
    caloriesOut: {
      bmr: { type: Number, default: 0 },
      workouts: { type: Number, default: 0 },
      steps: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    macros: {
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
    },
    waterMl: { type: Number, default: 0 },
    waterEntries: [
      {
        amount: Number,
        loggedAt: { type: Date, default: Date.now },
      },
    ],
    steps: { type: Number, default: 0 },
    stepsSyncedAt: { type: Date, default: null },
    stepsSource: { type: String, enum: ["step_counter", "manual"], default: "manual" },
  },
  { timestamps: true }
);

DailyLogSchema.index({ userId: 1, date: -1 });
DailyLogSchema.index({ userId: 1, dateString: 1 }, { unique: true });

const DailyLog: Model<IDailyLog> =
  mongoose.models.DailyLog ||
  mongoose.model<IDailyLog>("DailyLog", DailyLogSchema);

export default DailyLog;
