import "server-only";
import { HttpError, badRequest } from "@/lib/api/errors";
import { validateImageBuffer } from "@/lib/security/file-validator";
import { MEAL_LIMITS } from "@/lib/validation/nutrition";

export interface MealPhoto {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Reads and checks the photos of a multipart request: count, size and real
 * type (from the bytes). Any bad photo rejects the whole request, so a photo
 * is never silently left out of an analysis or a save.
 */
export async function readMealPhotos(form: FormData, field: string): Promise<MealPhoto[]> {
  const entries = form.getAll(field).filter((entry): entry is File => typeof entry !== "string");
  const files = entries.filter((file) => file.size > 0);
  if (files.length > MEAL_LIMITS.photosMax) {
    throw badRequest(`Attach at most ${MEAL_LIMITS.photosMax} photos per meal.`);
  }

  let total = 0;
  const photos: MealPhoto[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const label = files.length > 1 ? `Photo ${index + 1}` : "The photo";
    if (file.size > MEAL_LIMITS.photoBytesMax) {
      throw new HttpError(413, `${label} is too large (max ${Math.round(MEAL_LIMITS.photoBytesMax / (1024 * 1024))} MB).`);
    }
    total += file.size;
    if (total > MEAL_LIMITS.requestBytesMax) throw new HttpError(413, "The photos are too large together. Use fewer photos.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const check = validateImageBuffer(buffer, { maxBytes: MEAL_LIMITS.photoBytesMax });
    if (!check.valid) throw badRequest(`${label}: ${check.error}`);
    photos.push({ buffer, mimeType: check.mimeType });
  }
  return photos;
}
