import { ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { updateHabitSchema, type UpdateHabitInput } from "@/lib/validation/habits";
import { updateHabit } from "@/lib/habits/service";

/** PATCH /api/habits/:id — edit, archive (isActive: false) or restore (isActive: true). */
export const PATCH = route<UpdateHabitInput, undefined, { id: string }>(
  { body: updateHabitSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body, params }) => {
    const habit = await updateHabit(session.userId, session.timezone, params.id, body);
    return ok({ habit });
  }
);

/**
 * DELETE /api/habits/:id — archives the habit. Its completion history is kept
 * and it can be restored with PATCH { isActive: true }.
 */
export const DELETE = route<undefined, undefined, { id: string }>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const habit = await updateHabit(session.userId, session.timezone, params.id, { isActive: false });
    return ok({ habit, archived: true });
  }
);
