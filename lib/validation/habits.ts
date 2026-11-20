import { z } from "zod";
import { boundedInt, dateString, objectId, trimmedText } from "@/lib/validation/common";
import { daysBetween } from "@/lib/time";
import { normalizeHexColor } from "@/lib/habits/colors";

export const HABIT_NAME_MAX = 60;
export const HABIT_EMOJI_MAX = 16;
export const HABIT_DESCRIPTION_MAX = 280;
/** Longest date range one GET /api/habits/log may ask for. */
export const HABIT_LOG_MAX_RANGE_DAYS = 93;

const habitColor = z
  .string()
  .transform((value, ctx) => {
    const hex = normalizeHexColor(value);
    if (!hex) {
      ctx.addIssue({ code: "custom", message: "Colour must be a hex value such as #10b981" });
      return z.NEVER;
    }
    return hex;
  });

const habitEmoji = trimmedText(HABIT_EMOJI_MAX, 1);
/** Optional free text; "" (or whitespace) clears it. */
const habitDescription = trimmedText(HABIT_DESCRIPTION_MAX);

export const createHabitSchema = z.object({
  name: trimmedText(HABIT_NAME_MAX, 1),
  description: habitDescription.optional(),
  emoji: habitEmoji.optional(),
  color: habitColor.optional(),
});

export const updateHabitSchema = z
  .object({
    name: trimmedText(HABIT_NAME_MAX, 1).optional(),
    description: habitDescription.optional(),
    emoji: habitEmoji.optional(),
    color: habitColor.optional(),
    order: boundedInt(0, 10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), "Nothing to update");

export const habitLogSchema = z.object({
  habitId: objectId,
  dateString,
  action: z.enum(["check", "uncheck"]),
});

export const habitLogQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((q) => q.from <= q.to, "`from` must not be after `to`")
  .refine(
    (q) => daysBetween(q.from, q.to) < HABIT_LOG_MAX_RANGE_DAYS,
    `A range can cover at most ${HABIT_LOG_MAX_RANGE_DAYS} days`
  );

export const habitListQuerySchema = z.object({
  include: z.enum(["active", "all"]).optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type HabitLogInput = z.infer<typeof habitLogSchema>;
