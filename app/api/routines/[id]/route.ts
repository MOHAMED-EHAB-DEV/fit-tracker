import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { routineUpdateSchema } from "@/lib/validation/workouts";
import { archiveRoutine, getRoutine, updateRoutine } from "@/lib/workouts/routines";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({}, async ({ session, params }) => {
  return ok({ routine: await getRoutine(session.userId, objectId.parse(params.id)) });
});

export const PATCH = route<typeof routineUpdateSchema._output, undefined, Params>(
  { body: routineUpdateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params, body }) => {
    const routine = await updateRoutine(session.userId, objectId.parse(params.id), body, session.weightUnit);
    return ok({ routine });
  }
);

/** Archives the routine. Workouts already logged with it stay in history. */
export const DELETE = route<undefined, undefined, Params>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    await archiveRoutine(session.userId, objectId.parse(params.id));
    return ok({});
  }
);
