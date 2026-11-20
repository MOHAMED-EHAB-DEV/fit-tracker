import { ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { checkInUpdateSchema, type CheckInUpdateInput } from "@/lib/validation/body-comp";
import { deleteCheckIn, updateCheckIn } from "@/lib/body-comp/service";

/** PATCH /api/body-comp/:id — correct weight (kg), body fat, measurements (cm), notes or date. */
export const PATCH = route<CheckInUpdateInput, undefined, { id: string }>(
  { body: checkInUpdateSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body, params }) => {
    const result = await updateCheckIn(session.userId, session.timezone, params.id, body);
    return ok({ ...result });
  }
);

/** DELETE /api/body-comp/:id — deletes the check-in and destroys its photos in Cloudinary. */
export const DELETE = route<undefined, undefined, { id: string }>(
  { rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, params }) => {
    const result = await deleteCheckIn(session.userId, params.id);
    return ok({ deleted: true, ...result });
  }
);
