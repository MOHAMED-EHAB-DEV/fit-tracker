import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { restoreAdminExercise } from "@/lib/admin/exercises";

export const POST = route<undefined, undefined, { id: string }>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ params }) => ok({ exercise: await restoreAdminExercise(params.id) })
);
