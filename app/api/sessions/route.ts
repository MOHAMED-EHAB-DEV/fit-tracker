import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { sessionListQuerySchema, sessionStartSchema } from "@/lib/validation/workouts";
import { listSessions, startSession } from "@/lib/workouts/sessions";

/** Finished workouts, newest first, a page at a time. */
export const GET = route({ query: sessionListQuerySchema }, async ({ session, query }) => {
  return ok(await listSessions(session.userId, query));
});

/** Starts a workout (from a routine, as a repeat, or empty). */
export const POST = route(
  { body: sessionStartSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const result = await startSession(session, body);
    return ok(result, { status: 201 });
  }
);
