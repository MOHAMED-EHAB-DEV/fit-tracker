import { z } from "zod";
import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { applySessionToRoutine } from "@/lib/workouts/routines";

type Params = { id: string };
const bodySchema = z.object({ sessionId: objectId });

/** "Update routine with today's numbers": a finished workout becomes the new targets. */
export const POST = route<z.infer<typeof bodySchema>, undefined, Params>(
  { body: bodySchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params, body }) => {
    const routine = await applySessionToRoutine(session.userId, objectId.parse(params.id), body.sessionId);
    return ok({ routine });
  }
);
