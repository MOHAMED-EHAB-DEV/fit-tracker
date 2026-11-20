import { isEndAfterStart, normalizeTime, sortEventsByPlannerTime } from "@/lib/planner/time-sort";
import type { RecurrenceType } from "@/lib/planner/recurrence";

export type PlannerCategory = "workout" | "nutrition" | "habit" | "recovery" | "focus" | "other";

export const CATEGORY_COLORS: Record<PlannerCategory, string> = {
  workout: "#10b981",
  nutrition: "#f59e0b",
  habit: "#8b5cf6",
  recovery: "#14b8a6",
  focus: "#3b82f6",
  other: "#71717a",
};

const CATEGORIES = Object.keys(CATEGORY_COLORS) as PlannerCategory[];

export interface AiPlanEvent {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: PlannerCategory;
  color: string;
  linkedHabitIds: string[];
  recurrence: RecurrenceType;
}

export interface RawAiEvent {
  title?: unknown;
  description?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  category?: unknown;
  linkedHabitIds?: unknown;
}

const clip = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Turns model output into events that are safe to show and apply:
 * real HH:MM times, a known category, the category colour, only habit ids
 * the user owns, end after start (otherwise dropped), sorted, capped.
 * Every event is "once": repeating is the user's explicit choice.
 */
export function normalizeAiPlanEvents(
  raw: unknown,
  ownedHabitIds: Iterable<string>,
  maxEvents: number = 20
): AiPlanEvent[] {
  if (!Array.isArray(raw)) return [];
  const owned = new Set(Array.from(ownedHabitIds, (id) => id.toLowerCase()));
  const result: AiPlanEvent[] = [];

  for (const item of raw as RawAiEvent[]) {
    if (!item || typeof item !== "object") continue;
    const title = clip(item.title, 120);
    const startTime = normalizeTime(item.startTime);
    if (!title || !startTime) continue;

    let endTime = normalizeTime(item.endTime) || "";
    if (endTime && !isEndAfterStart(startTime, endTime)) endTime = "";

    const categoryText = typeof item.category === "string" ? item.category.toLowerCase() : "";
    const category = (CATEGORIES as string[]).includes(categoryText) ? (categoryText as PlannerCategory) : "other";

    const linkedHabitIds = Array.isArray(item.linkedHabitIds)
      ? Array.from(
          new Set(
            item.linkedHabitIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => id.trim().toLowerCase())
              .filter((id) => owned.has(id))
          )
        )
      : [];

    result.push({
      title,
      description: clip(item.description, 1000),
      startTime,
      endTime,
      category,
      color: CATEGORY_COLORS[category],
      linkedHabitIds,
      recurrence: "once",
    });
  }

  return sortEventsByPlannerTime(result).slice(0, maxEvents);
}
