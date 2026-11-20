import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { sessionFinishSchema } from "@/lib/validation/workouts";
import { finishSession } from "@/lib/workouts/sessions";

type Params = { id: string };

/** Finishes a workout. Safe to call twice: the second call returns the same result. */
export const POST = route<typeof sessionFinishSchema._output, undefined, Params>(
  { body: sessionFinishSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params, body }) => {
    return ok(await finishSession(session, objectId.parse(params.id), body));
  }
);
