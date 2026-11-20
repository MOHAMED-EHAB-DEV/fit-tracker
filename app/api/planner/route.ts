import { ok, parseWith, readJson, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { applyPlan, createEvent, listEventsForDate } from "@/lib/planner/service";
import {
  plannerBulkApplySchema,
  plannerDayQuerySchema,
  plannerEventCreateSchema,
} from "@/lib/validation/planner";

/** The day's events (one-time and recurring), completion projected for that day. */
export const GET = route({ query: plannerDayQuerySchema }, async ({ session, query }) => {
  const date = query.date || getTodayDateString(new Date(), session.timezone);
  const events = await listEventsForDate(session.userId, date);
  return ok({ events, date });
});

/**
 * Creates one event, or applies an AI plan when the body has `events`.
 * AI events are "once" unless the user picked a recurrence in the preview,
 * and only the events listed in `replaceEventIds` are removed.
 */
export const POST = route({ rateLimit: RATE_LIMITS.writePerMinute }, async ({ request, session }) => {
  const raw = await readJson(request);
  if (raw && typeof raw === "object" && "events" in raw) {
    const input = parseWith(plannerBulkApplySchema, raw);
    const result = await applyPlan(session.userId, input);
    return ok({ ...result, date: input.date });
  }
  const input = parseWith(plannerEventCreateSchema, raw);
  const event = await createEvent(session.userId, input);
  return ok({ event });
});
