import { NextRequest } from "next/server";
import {
  HttpError,
  assertNoMongoOperators,
  badRequest,
  enforceRateLimit,
  errorResponse,
  ok,
  parseWith,
  readJson,
  route,
  unauthorized,
} from "@/lib/api/route";
import { getServerSession } from "@/lib/auth/session";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { localDateString } from "@/lib/time";
import { MEAL_LIMITS, mealCreateSchema, mealsQuerySchema } from "@/lib/validation/nutrition";
import { createMealForUser, listMealsForDay } from "@/lib/nutrition/meals";
import { readMealPhotos } from "@/lib/nutrition/upload";

// Uploading photos to storage can take a few seconds.
export const maxDuration = 30;

/** Meals of one day (default: the user's today). */
export const GET = route({ query: mealsQuerySchema }, async ({ session, query }) => {
  const date = query.date || localDateString(new Date(), session.timezone);
  return ok({ date, meals: await listMealsForDay(session.userId, date) });
});

/**
 * Logs a meal.
 *  - JSON body: a manual meal (no photos).
 *  - multipart/form-data: field "meal" (the same JSON) plus up to 4 "photos".
 *    Photos are stored only here, after the user confirmed the meal.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) throw unauthorized();
    await enforceRateLimit(RATE_LIMITS.writePerMinute, session.userId);

    const contentType = request.headers.get("content-type") || "";
    let raw: unknown;
    let photos: Buffer[] = [];

    if (contentType.includes("multipart/form-data")) {
      const declared = Number(request.headers.get("content-length") || 0);
      if (declared > MEAL_LIMITS.requestBytesMax) throw new HttpError(413, "The photos are too large. Use fewer or smaller photos.");
      const form = await request.formData();
      const field = form.get("meal");
      if (typeof field !== "string" || field.length > 64 * 1024) throw badRequest("Missing meal details");
      try {
        raw = JSON.parse(field);
      } catch {
        throw badRequest("Invalid meal details");
      }
      assertNoMongoOperators(raw);
      photos = (await readMealPhotos(form, "photos")).map((photo) => photo.buffer);
      if (photos.length > 0) await enforceRateLimit(RATE_LIMITS.uploadPerHour, session.userId);
    } else {
      raw = await readJson(request, 64 * 1024);
    }

    const input = parseWith(mealCreateSchema, raw);
    const meal = await createMealForUser(session, input, photos);
    return ok({ meal }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "POST /api/meals");
  }
}
