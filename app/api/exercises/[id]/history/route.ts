import { route, ok } from "@/lib/api/route";
import { objectId } from "@/lib/validation/common";
import { getExerciseHistory } from "@/lib/workouts/sessions";
import { listPersonalRecords } from "@/lib/workouts/records";

type Params = { id: string };

/** Every time the user performed this exercise, plus their current records for it. */
export const GET = route<undefined, undefined, Params>({}, async ({ session, params }) => {
  const exerciseId = objectId.parse(params.id);
  const [history, records] = await Promise.all([
    getExerciseHistory(session.userId, exerciseId, 40),
    listPersonalRecords(session.userId, { exerciseId }),
  ]);
  return ok({ history, records });
});
