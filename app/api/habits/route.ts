import { ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createHabitSchema, habitListQuerySchema } from "@/lib/validation/habits";
import { createHabit, listHabits } from "@/lib/habits/service";

/** GET /api/habits[?include=all] — active habits, plus archived ones with include=all. */
export const GET = route({ query: habitListQuerySchema }, async ({ session, query }) => {
  const lists = await listHabits(session.userId, session.timezone, query.include === "all");
  return ok({ habits: lists.active, archived: lists.archived });
});

export const POST = route(
  { body: createHabitSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const habit = await createHabit(session.userId, session.timezone, body);
    return ok({ habit }, { status: 201 });
  }
);
