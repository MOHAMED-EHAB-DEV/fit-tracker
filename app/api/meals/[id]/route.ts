import { badRequest, ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { objectId } from "@/lib/validation/common";
import { mealUpdateSchema, type MealUpdateInput } from "@/lib/validation/nutrition";
import { deleteMealForUser, getMealForUser, updateMealForUser } from "@/lib/nutrition/meals";

type Params = { id: string };

function mealIdFrom(params: Params): string {
  const parsed = objectId.safeParse(params.id);
  if (!parsed.success) throw badRequest("Invalid meal id");
  return parsed.data;
}

export const GET = route<undefined, undefined, Params>({}, async ({ session, params }) =>
  ok({ meal: await getMealForUser(session.userId, mealIdFrom(params)) })
);

/** Edits a meal: text, type, day and time, ingredients and totals. */
export const PATCH = route<MealUpdateInput, undefined, Params>(
  { body: mealUpdateSchema, rateLimit: RATE_LIMITS.writePerMinute, maxBodyBytes: 64 * 1024 },
  async ({ session, params, body }) =>
    ok({ meal: await updateMealForUser(session, mealIdFrom(params), body) })
);

export const DELETE = route<undefined, undefined, Params>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const { dateString } = await deleteMealForUser(session.userId, mealIdFrom(params));
    return ok({ dateString });
  }
);
