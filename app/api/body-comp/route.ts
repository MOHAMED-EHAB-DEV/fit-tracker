import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { badRequest, errorResponse, ok, parseWith, route, unauthorized } from "@/lib/api/route";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/security/rate-limit";
import { checkInCreateSchema, checkInListQuerySchema, hasCheckInContent } from "@/lib/validation/body-comp";
import { readCheckInRequest } from "@/lib/body-comp/form";
import { validatePhotoFile } from "@/lib/body-comp/photos";
import { createCheckIn, listCheckIns } from "@/lib/body-comp/service";

export const maxDuration = 30;

/** GET /api/body-comp?limit=30&before=<ISO> — newest first, photos as short-lived signed URLs. */
export const GET = route({ query: checkInListQuerySchema }, async ({ session, query }) => {
  const page = await listCheckIns(session.userId, { limit: query.limit, before: query.before, beforeId: query.beforeId });
  return ok({ ...page });
});

/**
 * POST /api/body-comp — saves a check-in. Everything is validated before the
 * photo is uploaded. No AI runs here: an estimate the user already saw can be
 * attached as `aiAnalysis` (from POST /api/body-comp/estimate).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) throw unauthorized();
    await enforceRateLimit(RATE_LIMITS.writePerMinute, session.userId);

    const { fields, photo } = await readCheckInRequest(request);
    const input = parseWith(checkInCreateSchema, fields);
    if (!hasCheckInContent(input, Boolean(photo))) {
      throw badRequest("Add a weight, body fat, a measurement or a photo.");
    }

    let validatedPhoto = null;
    if (photo) {
      await enforceRateLimit(RATE_LIMITS.uploadPerHour, session.userId);
      validatedPhoto = await validatePhotoFile(photo);
    }

    const result = await createCheckIn(session.userId, session.timezone, input, validatedPhoto);
    return ok({ ...result }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "POST /api/body-comp");
  }
}
