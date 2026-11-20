import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { duplicateRoutine } from "@/lib/workouts/routines";

type Params = { id: string };

export const POST = route<undefined, undefined, Params>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const routine = await duplicateRoutine(session.userId, objectId.parse(params.id));
    return ok({ routine }, { status: 201 });
  }
);
