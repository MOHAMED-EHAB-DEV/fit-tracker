import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { weeklyScheduleSchema } from "@/lib/validation/workouts";
import { getWeeklySchedule, setWeeklySchedule } from "@/lib/workouts/schedule";

export const GET = route({}, async ({ session }) => {
  return ok({ days: await getWeeklySchedule(session.userId, session.weekStartDay) });
});

export const PUT = route(
  { body: weeklyScheduleSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    await setWeeklySchedule(session.userId, body.days);
    return ok({ days: await getWeeklySchedule(session.userId, session.weekStartDay) });
  }
);
