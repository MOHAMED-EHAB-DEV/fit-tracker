import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { planAssigneesSchema } from "@/lib/validation/admin";
import { updatePlanAssignees } from "@/lib/admin/nutrition-plans";

/** Assigns users to the plan and/or unassigns them: { add: [userId], remove: [userId] }. */
export const POST = route<typeof planAssigneesSchema._output, undefined, { id: string }>(
  { auth: "admin", body: planAssigneesSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params, body }) => ok({ plan: await updatePlanAssignees(params.id, body.add, body.remove) })
);
