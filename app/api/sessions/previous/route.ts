import { z } from "zod";
import { route, ok } from "@/lib/api/route";
import { getPreviousPerformance } from "@/lib/workouts/sessions";

const querySchema = z.object({
  exerciseIds: z
    .string()
    .max(2000)
    .transform((value) => value.split(",").filter((id) => /^[a-f\d]{24}$/i.test(id)).slice(0, 40)),
  excludeSessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

/** What the user did last time for each of the given exercises. */
export const GET = route({ query: querySchema }, async ({ session, query }) => {
  const previous = await getPreviousPerformance(session.userId, query.exerciseIds, query.excludeSessionId);
  return ok({ previous });
});
