import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { sessionSaveSchema } from "@/lib/validation/workouts";
import {
  deleteSession,
  discardSession,
  getPreviousPerformance,
  getSession,
  saveSession,
} from "@/lib/workouts/sessions";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({}, async ({ session, params }) => {
  const workout = await getSession(session.userId, objectId.parse(params.id));
  const previous =
    workout.status === "in_progress"
      ? await getPreviousPerformance(
          session.userId,
          workout.exercises.map((exercise) => exercise.exerciseId),
          workout.id
        )
      : [];
  return ok({ session: workout, previous });
});

/** Autosave while a workout is in progress, or an edit of a finished one. */
export const PATCH = route<typeof sessionSaveSchema._output, undefined, Params>(
  { body: sessionSaveSchema, rateLimit: { name: "session-save", limit: 240, windowSeconds: 60 } },
  async ({ session, params, body }) => {
    return ok({ session: await saveSession(session, objectId.parse(params.id), body) });
  }
);

/**
 * In progress: discards it. Finished: deletes it from history and rebuilds
 * the records and day totals that depended on it.
 */
export const DELETE = route<undefined, undefined, Params>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const id = objectId.parse(params.id);
    const workout = await getSession(session.userId, id);
    if (workout.status === "in_progress") await discardSession(session.userId, id);
    else await deleteSession(session.userId, id);
    return ok({});
  }
);
