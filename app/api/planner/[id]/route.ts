import { badRequest, ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { plannerDeleteQuerySchema, plannerEventPatchSchema } from "@/lib/validation/planner";
import { deleteEvent, updateEvent } from "@/lib/planner/service";

type Params = { id: string };

function eventId(params: Params): string {
  const parsed = objectId.safeParse(params.id);
  if (!parsed.success) throw badRequest("Invalid event id");
  return parsed.data;
}

/** Edits an event and/or marks the occurrence on `targetDate` done or not done. */
export const PATCH = route<ReturnType<typeof plannerEventPatchSchema.parse>, undefined, Params>(
  { body: plannerEventPatchSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body, params }) => {
    const event = await updateEvent(session.userId, eventId(params), body);
    return ok({ event });
  }
);

/** mode=this (one day of a series), following (this day onwards) or all. */
export const DELETE = route<undefined, ReturnType<typeof plannerDeleteQuerySchema.parse>, Params>(
  { query: plannerDeleteQuerySchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, query, params }) => {
    const result = await deleteEvent(session.userId, eventId(params), query.mode, query.date);
    return ok(result);
  }
);
