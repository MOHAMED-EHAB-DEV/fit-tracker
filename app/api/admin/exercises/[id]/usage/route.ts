import { route, ok } from "@/lib/api/route";
import { getExerciseUsage } from "@/lib/admin/exercises";

/** How many routines and workouts use the exercise (shown before archiving). */
export const GET = route<undefined, undefined, { id: string }>({ auth: "admin" }, async ({ params }) =>
  ok({ usage: await getExerciseUsage(params.id) })
);
