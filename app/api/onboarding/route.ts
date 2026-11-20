import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { onboardingSchema } from "@/lib/validation/profile";
import { updateUserProfile } from "@/lib/users/profile";

export const POST = route(
  { body: onboardingSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    await updateUserProfile(
      session.userId,
      {
        fitnessProfile: {
          sex: body.sex,
          ...(body.birthDate ? { birthDate: body.birthDate } : {}),
          ...(body.age !== undefined ? { age: body.age } : {}),
          weightKg: body.weightKg,
          heightCm: body.heightCm,
          activityLevel: body.activityLevel,
          goal: body.goal,
        },
        preferences: {
          stepGoal: body.stepGoal ?? 10_000,
          waterGoalMl: body.waterGoalMl ?? 3_000,
          restTimerDefaultSec: body.restTimerDefaultSec ?? 90,
          ...(body.weightUnit ? { weightUnit: body.weightUnit } : {}),
          ...(body.timezone ? { timezone: body.timezone } : {}),
        },
      },
      { completeProfile: true }
    );
    return ok({});
  }
);
