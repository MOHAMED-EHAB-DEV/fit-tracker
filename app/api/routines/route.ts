import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { routineCreateSchema } from "@/lib/validation/workouts";
import { createRoutine, listRoutines } from "@/lib/workouts/routines";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";

export const GET = route({}, async ({ session }) => {
  await ensureWorkoutsMigrated(session.userId);
  return ok({ routines: await listRoutines(session.userId) });
});

export const POST = route(
  { body: routineCreateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const result = await createRoutine(session.userId, body, session.weightUnit);
    return ok(result, { status: 201 });
  }
);
