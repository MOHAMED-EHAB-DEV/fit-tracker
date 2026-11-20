import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { customExerciseUpdateSchema } from "@/lib/validation/workouts";
import { archiveCustomExercise, getExercise, updateCustomExercise } from "@/lib/workouts/exercises";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({}, async ({ session, params }) => {
  const exercise = await getExercise(session.userId, objectId.parse(params.id));
  return ok({ exercise });
});

export const PATCH = route<typeof customExerciseUpdateSchema._output, undefined, Params>(
  { body: customExerciseUpdateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params, body }) => {
    const exercise = await updateCustomExercise(session.userId, objectId.parse(params.id), body);
    return ok({ exercise });
  }
);

export const DELETE = route<undefined, undefined, Params>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    await archiveCustomExercise(session.userId, objectId.parse(params.id));
    return ok({});
  }
);
