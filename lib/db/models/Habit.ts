import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHabit extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  emoji: string;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HabitSchema = new Schema<IHabit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "⚡" },
    color: { type: String, default: "#10b981" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

HabitSchema.index({ userId: 1, isActive: 1, order: 1 });

const Habit: Model<IHabit> =
  mongoose.models.Habit || mongoose.model<IHabit>("Habit", HabitSchema);

export default Habit;
