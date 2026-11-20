import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { exerciseCreateSchema, exerciseListQuery } from "@/lib/validation/admin";
import { createAdminExercise, listAdminExercises } from "@/lib/admin/exercises";

export const GET = route({ auth: "admin", query: exerciseListQuery }, async ({ query }) =>
  ok(await listAdminExercises(query))
);

export const POST = route(
  { auth: "admin", body: exerciseCreateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const exercise = await createAdminExercise(session.userId, body);
    return ok({ exercise }, { status: 201 });
  }
);
