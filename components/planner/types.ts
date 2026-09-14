export type EventCategory =
  | "workout"
  | "nutrition"
  | "habit"
  | "recovery"
  | "focus"
  | "other";

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

export interface LinkedHabit {
  _id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface PlannedEventItem {
  _id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  startTime: string; // HH:mm
  endTime?: string;
  category: EventCategory;
  color: string;
  recurrence?: RecurrenceType;
  completedDates?: string[];
  excludedDates?: string[];
  linkedHabitIds: LinkedHabit[];
  isCompleted: boolean;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HabitOption {
  _id: string;
  name: string;
  emoji: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<
  EventCategory,
  {
    label: string;
    iconName: string;
    badgeBg: string;
    badgeText: string;
    borderCol: string;
    defaultColor: string;
  }
> = {
  workout: {
    label: "Workout",
    iconName: "Dumbbell",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-400",
    borderCol: "border-emerald-500/30",
    defaultColor: "#10b981",
  },
  nutrition: {
    label: "Nutrition",
    iconName: "Utensils",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-400",
    borderCol: "border-amber-500/30",
    defaultColor: "#f59e0b",
  },
  habit: {
    label: "Habit",
    iconName: "Zap",
    badgeBg: "bg-violet-500/10",
    badgeText: "text-violet-400",
    borderCol: "border-violet-500/30",
    defaultColor: "#8b5cf6",
  },
  recovery: {
    label: "Recovery",
    iconName: "HeartPulse",
    badgeBg: "bg-teal-500/10",
    badgeText: "text-teal-400",
    borderCol: "border-teal-500/30",
    defaultColor: "#14b8a6",
  },
  focus: {
    label: "Deep Focus",
    iconName: "Sparkles",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-400",
    borderCol: "border-blue-500/30",
    defaultColor: "#3b82f6",
  },
  other: {
    label: "General",
    iconName: "Clock",
    badgeBg: "bg-zinc-500/10",
    badgeText: "text-zinc-400",
    borderCol: "border-zinc-500/30",
    defaultColor: "#71717a",
  },
};

export * from "@/lib/planner/time-sort";
