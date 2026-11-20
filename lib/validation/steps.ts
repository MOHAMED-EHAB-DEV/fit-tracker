import { z } from "zod";
import { dateString } from "@/lib/validation/common";
import { addDays } from "@/lib/time";

/** Highest step total accepted for one day. */
export const MAX_DAILY_STEPS = 200_000;

export const stepSource = z.enum(["step_counter", "manual"]);
export type StepSource = z.infer<typeof stepSource>;

/**
 * POST /api/steps/sync.
 * - "step_counter": a reading from the Android pedometer; the stored value only ever goes up.
 * - "manual": the user typed the day's total; it replaces the stored value.
 * `dateString` defaults to the user's today.
 */
export const stepsSyncBody = z.object({
  steps: z.number().int("Steps must be a whole number").min(0).max(MAX_DAILY_STEPS),
  source: stepSource.optional().default("manual"),
  dateString: dateString.optional(),
});
export type StepsSyncBody = z.infer<typeof stepsSyncBody>;

export const stepsQuery = z.object({
  date: dateString.optional(),
});

/**
 * Steps may be written for the user's today or yesterday only (yesterday so a
 * phone can close out the previous day after midnight). Returns an error
 * message, or null when the date is allowed.
 */
export function stepsDateError(date: string, today: string): string | null {
  if (date > today) return "Steps cannot be logged for a future date";
  if (date < addDays(today, -1)) return "Steps can only be logged for today or yesterday";
  return null;
}
