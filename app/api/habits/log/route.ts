import { ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { habitLogQuerySchema, habitLogSchema } from "@/lib/validation/habits";
import { listHabitLogs, logHabit } from "@/lib/habits/service";

/** POST /api/habits/log { habitId, dateString, action: "check" | "uncheck" } */
export const POST = route(
  { body: habitLogSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const result = await logHabit(session.userId, session.timezone, body);
    return ok({ ...result });
  }
);

/** GET /api/habits/log?from=YYYY-MM-DD&to=YYYY-MM-DD (at most 93 days). */
export const GET = route({ query: habitLogQuerySchema }, async ({ session, query }) => {
  const logs = await listHabitLogs(session.userId, query.from, query.to);
  return ok({ logs });
});
