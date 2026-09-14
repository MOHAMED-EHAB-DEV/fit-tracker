import mongoose, { Schema, Document, Model } from "mongoose";
import "./Habit";
import "./User";

export type EventCategory =
  | "workout"
  | "nutrition"
  | "habit"
  | "recovery"
  | "focus"
  | "other";

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

export interface IPlannedEvent extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  startTime: string; // HH:mm (24h)
  endTime?: string; // HH:mm (24h)
  category: EventCategory;
  color: string;
  recurrence: RecurrenceType;
  completedDates: string[]; // YYYY-MM-DD strings for recurring events
  excludedDates: string[]; // YYYY-MM-DD strings where recurrence was deleted
  linkedHabitIds: mongoose.Types.ObjectId[];
  isCompleted: boolean;
  completedAt: Date | null;
  notificationSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlannedEventSchema = new Schema<IPlannedEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, default: "", trim: true },
    category: {
      type: String,
      enum: ["workout", "nutrition", "habit", "recovery", "focus", "other"],
      default: "other",
    },
    color: { type: String, default: "#10b981" },
    recurrence: {
      type: String,
      enum: ["once", "daily", "weekly", "monthly"],
      default: "once",
      index: true,
    },
    completedDates: [{ type: String }],
    excludedDates: [{ type: String }],
    linkedHabitIds: [{ type: Schema.Types.ObjectId, ref: "Habit" }],
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    notificationSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PlannedEventSchema.index({ userId: 1, date: 1, startTime: 1 });
PlannedEventSchema.index({ userId: 1, recurrence: 1 });

const PlannedEvent: Model<IPlannedEvent> =
  mongoose.models.PlannedEvent ||
  mongoose.model<IPlannedEvent>("PlannedEvent", PlannedEventSchema);

export default PlannedEvent;
