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

export const CATEGORY_CONFIG: Record<
  EventCategory,
  { label: string; badgeBg: string; badgeText: string; borderCol: string; defaultColor: string }
> = {
  workout: {
    label: "Workout",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    borderCol: "border-emerald-500/30",
    defaultColor: CATEGORY_COLORS.workout,
  },
  nutrition: {
    label: "Nutrition",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-400",
    borderCol: "border-amber-500/30",
    defaultColor: CATEGORY_COLORS.nutrition,
  },
  habit: {
    label: "Habit",
    badgeBg: "bg-violet-500/10",
    badgeText: "text-violet-400",
    borderCol: "border-violet-500/30",
    defaultColor: CATEGORY_COLORS.habit,
  },
  recovery: {
    label: "Recovery",
    badgeBg: "bg-teal-500/10",
    badgeText: "text-teal-400",
    borderCol: "border-teal-500/30",
    defaultColor: CATEGORY_COLORS.recovery,
  },
  focus: {
    label: "Deep Focus",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-400",
    borderCol: "border-blue-500/30",
    defaultColor: CATEGORY_COLORS.focus,
  },
  other: {
    label: "General",
    badgeBg: "bg-zinc-500/10",
    badgeText: "text-zinc-400",
    borderCol: "border-zinc-500/30",
    defaultColor: CATEGORY_COLORS.other,
  },
};

export const RECURRENCE_LABEL: Record<RecurrenceType, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export { readApiResponse } from "@/lib/assistant/http";
export * from "@/lib/planner/time-sort";
