import type { RecurrenceType } from "@/lib/planner/recurrence";
import type { PlannerCategory } from "@/lib/planner/ai-plan";

export interface LinkedHabitDTO {
  _id: string;
  name: string;
  emoji: string;
  color: string;
}

/** One planner event as seen on one day. */
export interface PlannerEventDTO {
  _id: string;
  /** First day of a series, or the day of a one-time event. */
  date: string;
  /** The day this occurrence is shown for. */
  occurrenceDate: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: PlannerCategory;
  color: string;
  recurrence: RecurrenceType;
  endDate: string | null;
  linkedHabitIds: LinkedHabitDTO[];
  isCompleted: boolean;
}
