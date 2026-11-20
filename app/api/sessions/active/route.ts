import { route, ok } from "@/lib/api/route";
import { getActiveSession } from "@/lib/workouts/sessions";

/** The workout in progress, or null. Reading it never changes anything. */
export const GET = route({}, async ({ session }) => {
  return ok({ session: await getActiveSession(session.userId) });
});
