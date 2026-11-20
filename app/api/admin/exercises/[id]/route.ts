import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { exerciseUpdateSchema } from "@/lib/validation/admin";
import {
  archiveAdminExercise,
  getAdminExercise,
  getExerciseUsage,
  updateAdminExercise,
} from "@/lib/admin/exercises";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({ auth: "admin" }, async ({ params }) =>
  ok({ exercise: await getAdminExercise(params.id) })
);

/** Saves the whole exercise. Refused with 409 when it changed since the editor loaded it. */
export const PATCH = route<typeof exerciseUpdateSchema._output, undefined, Params>(
  { auth: "admin", body: exerciseUpdateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params, body }) => ok(await updateAdminExercise(params.id, body.exercise, body.expectedUpdatedAt))
);

/** Archives the exercise (no hard delete: routines and history keep pointing at it). */
export const DELETE = route<undefined, undefined, Params>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params }) => {
    const [exercise, usage] = await Promise.all([archiveAdminExercise(params.id), getExerciseUsage(params.id)]);
    return ok({ exercise, usage });
  }
);
