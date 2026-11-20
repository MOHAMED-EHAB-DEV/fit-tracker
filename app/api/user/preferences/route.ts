import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { preferencesPatch } from "@/lib/validation/profile";
import { updateUserProfile } from "@/lib/users/profile";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { normalizeWeekStart, resolveTimeZone } from "@/lib/time";
import { normalizeWeightUnit } from "@/lib/fitness/units";

async function readPreferences(userId: string) {
  await getDb();
  const user = await User.findById(userId).select("preferences").lean();
  const prefs = user?.preferences;
  return {
    stepGoal: prefs?.stepGoal ?? null,
    waterGoalMl: prefs?.waterGoalMl ?? null,
    restTimerDefaultSec: prefs?.restTimerDefaultSec ?? null,
    weightUnit: normalizeWeightUnit(prefs?.weightUnit),
    timezone: resolveTimeZone(prefs?.timezone),
    weekStartDay: normalizeWeekStart(prefs?.weekStartDay),
  };
}

export const GET = route({}, async ({ session }) => {
  return ok({ preferences: await readPreferences(session.userId) });
});

export const PATCH = route(
  { body: preferencesPatch, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    await updateUserProfile(session.userId, { preferences: body });
    return ok({ preferences: await readPreferences(session.userId) });
  }
);
