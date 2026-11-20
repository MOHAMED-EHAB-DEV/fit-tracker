import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { nutritionPlanSchema, planListQuery } from "@/lib/validation/admin";
import { createPlan, listPlans } from "@/lib/admin/nutrition-plans";

export const GET = route({ auth: "admin", query: planListQuery }, async ({ query }) => ok(await listPlans(query)));

export const POST = route(
  { auth: "admin", body: nutritionPlanSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => ok({ plan: await createPlan(session.userId, body) }, { status: 201 })
);
