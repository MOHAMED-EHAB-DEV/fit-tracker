import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { customExerciseSchema } from "@/lib/validation/workouts";
import { createCustomExercise, listExerciseCatalog } from "@/lib/workouts/exercises";

/** The whole exercise list in light form; the picker filters it locally. */
export const GET = route({}, async ({ session }) => {
  const exercises = await listExerciseCatalog(session.userId);
  return ok({ exercises }, { headers: { "Cache-Control": "private, max-age=60" } });
});

/** Creates a custom exercise for the signed-in user. */
export const POST = route(
  { body: customExerciseSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const exercise = await createCustomExercise(session.userId, body);
    return ok({ exercise }, { status: 201 });
  }
);
