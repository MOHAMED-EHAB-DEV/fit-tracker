import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { nutritionPlanSchema, type NutritionPlanInput } from "@/lib/validation/admin";
import { deletePlan, getPlan, updatePlan } from "@/lib/admin/nutrition-plans";

type Params = { id: string };

export const GET = route<undefined, undefined, Params>({ auth: "admin" }, async ({ params }) =>
  ok({ plan: await getPlan(params.id) })
);

/** Replaces the plan's details and meals. Assignments are changed through ./assignees. */
export const PATCH = route<NutritionPlanInput, undefined, Params>(
  { auth: "admin", body: nutritionPlanSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params, body }) => ok({ plan: await updatePlan(params.id, body) })
);

export const DELETE = route<undefined, undefined, Params>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params }) => {
    await deletePlan(params.id);
    return ok({ message: "Nutrition plan deleted" });
  }
);
