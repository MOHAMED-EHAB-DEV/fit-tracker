import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWeeklyRoutineDay {
  dayOfWeek: "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
  workoutName: string;
  isRestDay: boolean;
  targetMuscleGroups?: string[];
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: "user" | "admin";
  isBanned: boolean;
  tokenVersion: number;
  isProfileComplete: boolean;
  fitnessProfile: {
    sex: "male" | "female" | null;
    birthDate: Date | null;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
    goal: "cut" | "maintain" | "bulk" | null;
    targetCalories: number | null;
    targetProteinG: number | null;
    targetCarbsG: number | null;
    targetFatG: number | null;
    targetFiberG: number | null;
  };
  preferences: {
    stepGoal: number | null;
    waterGoalMl: number | null;
    weekStartDay: string;
    timezone: string;
    weightUnit: "kg" | "lbs";
    restTimerDefaultSec: number | null;
    customGeminiApiKey?: string | null;
  };
  weeklyRoutine: IWeeklyRoutineDay[];
  computed: {
    bmr: number | null;
    tdee: number | null;
    proteinTargetG: number | null;
    carbsTargetG: number | null;
    fatTargetG: number | null;
    fiberTargetG: number | null;
    lastComputedAt: Date | null;
  };
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_WEEKLY_ROUTINE: IWeeklyRoutineDay[] = [
  { dayOfWeek: "saturday", workoutName: "Push Day (Chest, Shoulders, Triceps)", isRestDay: false, targetMuscleGroups: ["Chest", "Shoulders", "Arms"] },
  { dayOfWeek: "sunday", workoutName: "Pull Day (Back & Biceps)", isRestDay: false, targetMuscleGroups: ["Back", "Arms"] },
  { dayOfWeek: "monday", workoutName: "Leg Day (Quads, Hams, Calves)", isRestDay: false, targetMuscleGroups: ["Legs", "Core"] },
  { dayOfWeek: "tuesday", workoutName: "Rest & Active Recovery", isRestDay: true, targetMuscleGroups: [] },
  { dayOfWeek: "wednesday", workoutName: "Upper Body Power", isRestDay: false, targetMuscleGroups: ["Chest", "Back", "Shoulders"] },
  { dayOfWeek: "thursday", workoutName: "Lower Body & Core", isRestDay: false, targetMuscleGroups: ["Legs", "Core"] },
  { dayOfWeek: "friday", workoutName: "Rest / Active Recovery", isRestDay: true, targetMuscleGroups: [] },
];

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBanned: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    isProfileComplete: { type: Boolean, default: false },
    fitnessProfile: {
      sex: { type: String, enum: ["male", "female"], default: null },
      birthDate: { type: Date, default: null },
      age: { type: Number, default: null },
      weightKg: { type: Number, default: null },
      heightCm: { type: Number, default: null },
      activityLevel: {
        type: String,
        enum: ["sedentary", "light", "moderate", "active", "very_active"],
        default: null,
      },
      goal: { type: String, enum: ["cut", "maintain", "bulk"], default: null },
      targetCalories: { type: Number, default: null },
      targetProteinG: { type: Number, default: null },
      targetCarbsG: { type: Number, default: null },
      targetFatG: { type: Number, default: null },
      targetFiberG: { type: Number, default: null },
    },
    preferences: {
      stepGoal: { type: Number, default: null },
      waterGoalMl: { type: Number, default: null },
      weekStartDay: { type: String, default: "saturday" },
      timezone: { type: String, default: "Africa/Cairo" },
      weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
      restTimerDefaultSec: { type: Number, default: null },
      customGeminiApiKey: { type: String, default: null },
    },
    weeklyRoutine: {
      type: [
        {
          dayOfWeek: {
            type: String,
            enum: ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"],
            required: true,
          },
          workoutName: { type: String, required: true },
          isRestDay: { type: Boolean, default: false },
          targetMuscleGroups: [{ type: String }],
          _id: false,
        },
      ],
      default: DEFAULT_WEEKLY_ROUTINE,
    },
    computed: {
      bmr: { type: Number, default: null },
      tdee: { type: Number, default: null },
      proteinTargetG: { type: Number, default: null },
      carbsTargetG: { type: Number, default: null },
      fatTargetG: { type: Number, default: null },
      fiberTargetG: { type: Number, default: null },
      lastComputedAt: { type: Date, default: null },
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
