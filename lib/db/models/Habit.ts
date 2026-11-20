import mongoose, { Schema, Document, Model } from "mongoose";

export interface IHabit extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  /** Optional free text; "" when not set (older documents may lack the field). */
  description: string;
  emoji: string;
  /** 6-digit hex ("#10b981"); older documents may hold other CSS colours. */
  color: string;
  order: number;
  /** false = archived. Completion history in DailyLog is kept either way. */
  isActive: boolean;
  /** When the habit was archived (null while active). */
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const HabitSchema = new Schema<IHabit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 280 },
    emoji: { type: String, default: "⚡", maxlength: 16 },
    color: { type: String, default: "#10b981", maxlength: 32 },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

HabitSchema.index({ userId: 1, isActive: 1, order: 1 });

const Habit: Model<IHabit> =
  mongoose.models.Habit || mongoose.model<IHabit>("Habit", HabitSchema);

export default Habit;
