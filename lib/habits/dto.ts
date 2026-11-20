import { localDateString } from "@/lib/time";
import { DEFAULT_HABIT_EMOJI, safeHabitColor } from "@/lib/habits/colors";
import type { HabitLifespan } from "@/lib/habits/completion";

/** The habit shape sent to client components and returned by the API. */
export interface HabitDTO extends HabitLifespan {
  _id: string;
  name: string;
  /** "" when the habit has no description. */
  description: string;
  emoji: string;
  color: string;
  order: number;
  isActive: boolean;
}

/** Minimal fields read from a Habit document (lean or hydrated). */
export interface HabitDocLike {
  _id: { toString(): string; getTimestamp?: () => Date };
  name?: string | null;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  order?: number | null;
  isActive?: boolean | null;
  archivedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toHabitDTO(doc: HabitDocLike, timeZone: string): HabitDTO {
  const isActive = doc.isActive !== false;
  const created =
    toDate(doc.createdAt) ?? (typeof doc._id.getTimestamp === "function" ? doc._id.getTimestamp() : null);
  // Habits archived before archivedAt existed: their last update is the archive.
  const archived = isActive ? null : toDate(doc.archivedAt) ?? toDate(doc.updatedAt) ?? new Date();
  return {
    _id: doc._id.toString(),
    name: doc.name || "",
    description: doc.description || "",
    emoji: doc.emoji || DEFAULT_HABIT_EMOJI,
    color: safeHabitColor(doc.color),
    order: doc.order || 0,
    isActive,
    createdDate: created ? localDateString(created, timeZone) : "",
    archivedDate: archived ? localDateString(archived, timeZone) : null,
  };
}
