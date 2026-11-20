import { z } from "zod";
import { dateString, objectId, timeString, trimmedText } from "@/lib/validation/common";
import { isEndAfterStart } from "@/lib/planner/time-sort";

export const eventCategory = z.enum(["workout", "nutrition", "habit", "recovery", "focus", "other"]);
export const recurrenceType = z.enum(["once", "daily", "weekly", "monthly"]);
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a #RRGGBB value");

export const MAX_LINKED_HABITS = 20;
export const MAX_AI_EVENTS = 20;

const linkedHabitIds = z.array(objectId).max(MAX_LINKED_HABITS).transform((ids) => Array.from(new Set(ids)));

/** "" or HH:MM. */
const optionalTime = z.union([z.literal(""), timeString]);

const endAfterStart = (value: { startTime?: string; endTime?: string }) =>
  !value.endTime || !value.startTime || isEndAfterStart(value.startTime, value.endTime);
const END_AFTER_START = { message: "End time must be after the start time", path: ["endTime"] };

export const plannerEventFields = z.object({
  title: trimmedText(120, 1),
  description: trimmedText(1000).optional().default(""),
  startTime: timeString,
  endTime: optionalTime.optional().default(""),
  category: eventCategory.optional().default("other"),
  color: hexColor.optional(),
  recurrence: recurrenceType.optional().default("once"),
  linkedHabitIds: linkedHabitIds.optional().default([]),
});

export const plannerEventCreateSchema = plannerEventFields
  .extend({ date: dateString })
  .refine(endAfterStart, END_AFTER_START);

export type PlannerEventCreate = z.infer<typeof plannerEventCreateSchema>;

/** Applying an AI plan: every event is validated before anything is written. */
export const plannerBulkApplySchema = z.object({
  date: dateString,
  events: z
    .array(plannerEventFields.refine(endAfterStart, END_AFTER_START))
    .min(1, "Pick at least one event")
    .max(MAX_AI_EVENTS),
  /** One-time events of `date` the user agreed to remove (shown in the preview). */
  replaceEventIds: z.array(objectId).max(200).optional().default([]),
});

export type PlannerBulkApply = z.infer<typeof plannerBulkApplySchema>;

export const plannerEventPatchSchema = z
  .object({
    /** The day the event is being viewed on (for recurring completion). */
    targetDate: dateString,
    isCompleted: z.boolean().optional(),
    title: trimmedText(120, 1).optional(),
    description: trimmedText(1000).optional(),
    startTime: timeString.optional(),
    endTime: optionalTime.optional(),
    category: eventCategory.optional(),
    color: hexColor.optional(),
    recurrence: recurrenceType.optional(),
    linkedHabitIds: linkedHabitIds.optional(),
  })
  .refine(endAfterStart, END_AFTER_START);

export type PlannerEventPatch = z.infer<typeof plannerEventPatchSchema>;

export const plannerDayQuerySchema = z.object({ date: dateString.optional() });

export const plannerDeleteQuerySchema = z.object({
  /** "this": only `date`; "following": `date` and later; "all": the whole event. */
  mode: z.enum(["this", "following", "all"]).optional().default("all"),
  date: dateString.optional(),
});

export const plannerGenerateSchema = z.object({
  date: dateString,
  notes: trimmedText(500).optional().default(""),
});

/** One event as returned by the model (loose; normalised afterwards). */
export const aiPlannerEventSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(""),
  startTime: z.string(),
  endTime: z.string().optional().default(""),
  category: z.string().optional().default("other"),
  linkedHabitIds: z.array(z.string()).optional().default([]),
});
