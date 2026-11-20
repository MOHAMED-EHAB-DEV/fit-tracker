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

export const EVENT_CATEGORIES: EventCategory[] = ["workout", "nutrition", "habit", "recovery", "focus", "other"];
export const RECURRENCE_TYPES: RecurrenceType[] = ["once", "daily", "weekly", "monthly"];

/** Habits a planner completion ticked on a day (so un-completing removes only those). */
export interface IHabitSyncEntry {
  date: string;
  habitIds: mongoose.Types.ObjectId[];
}

export interface IPlannedEvent extends Document {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD: the day of a one-time event, or the first day of a series
  title: string;
  description: string;
  startTime: string; // HH:mm (24h)
  endTime?: string; // HH:mm (24h) or ""
  category: EventCategory;
  color: string;
  recurrence: RecurrenceType;
  /** Last day (inclusive) of a series; null = no end. */
  endDate: string | null;
  completedDates: string[]; // YYYY-MM-DD strings for recurring events
  excludedDates: string[]; // YYYY-MM-DD strings where one occurrence was removed
  linkedHabitIds: mongoose.Types.ObjectId[];
  habitSyncLog: IHabitSyncEntry[];
  isCompleted: boolean;
  completedAt: Date | null;
  notificationSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlannedEventSchema = new Schema<IPlannedEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    startTime: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: (value: string) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        message: "End time must be HH:MM",
      },
    },
    category: { type: String, enum: EVENT_CATEGORIES, default: "other" },
    color: { type: String, default: "#10b981", match: /^#[0-9a-fA-F]{6}$/ },
    recurrence: { type: String, enum: RECURRENCE_TYPES, default: "once", index: true },
    endDate: { type: String, default: null },
    completedDates: [{ type: String }],
    excludedDates: [{ type: String }],
    linkedHabitIds: [{ type: Schema.Types.ObjectId, ref: "Habit" }],
    habitSyncLog: {
      type: [
        {
          date: { type: String, required: true },
          habitIds: [{ type: Schema.Types.ObjectId, ref: "Habit" }],
          _id: false,
        },
      ],
      default: [],
    },
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
