import type { PlannerCategory } from "@/lib/planner/ai-plan";
import { CATEGORY_COLORS } from "@/lib/planner/ai-plan";
import type { PlannerEventDTO, LinkedHabitDTO } from "@/lib/planner/types";
import type { RecurrenceType } from "@/lib/planner/recurrence";

export type EventCategory = PlannerCategory;
export type { RecurrenceType };
export type PlannedEventItem = PlannerEventDTO;
export type LinkedHabit = LinkedHabitDTO;

export interface HabitOption {
  _id: string;
  name: string;
  emoji: string;
  color: string;
}

/** Fields the add/edit forms produce. */
export interface EventFormValues {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: EventCategory;
  color: string;
  recurrence: RecurrenceType;
  linkedHabitIds: string[];
}

export const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Event categories: a plain label; the event's own colour shows only as a thin bar. */
export const CATEGORY_CONFIG: Record<EventCategory, { label: string; defaultColor: string }> = {
  workout: { label: "Workout", defaultColor: CATEGORY_COLORS.workout },
  nutrition: { label: "Nutrition", defaultColor: CATEGORY_COLORS.nutrition },
  habit: { label: "Habit", defaultColor: CATEGORY_COLORS.habit },
  recovery: { label: "Recovery", defaultColor: CATEGORY_COLORS.recovery },
  focus: { label: "Deep focus", defaultColor: CATEGORY_COLORS.focus },
  other: { label: "General", defaultColor: CATEGORY_COLORS.other },
};

export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export { readApiResponse } from "@/lib/assistant/http";
export * from "@/lib/planner/time-sort";
