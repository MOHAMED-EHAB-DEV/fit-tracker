import { after, type NextRequest } from "next/server";
import { errorResponse, ok, readJson, parseWith } from "@/lib/api/route";
import { HttpError, badRequest, forbidden, unauthorized } from "@/lib/api/errors";
import { getServerSession } from "@/lib/auth/session";
import { enforceRateLimit, type RateLimitRule } from "@/lib/security/rate-limit";
import { validateAttachment } from "@/lib/security/file-validator";
import { imageDiscardSchema } from "@/lib/validation/admin";
import {
  destroyUnusedExerciseImages,
  exerciseImagePublicId,
  sweepPendingExerciseImages,
  uploadExerciseImage,
} from "@/lib/admin/exercise-images";

/**
 * One exercise image per request. The browser downscales photos first, so a
 * request stays far below the proxy's 10 MB body buffer.
 */

export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ADMIN_UPLOADS: RateLimitRule = { name: "admin-exercise-upload", limit: 300, windowSeconds: 60 * 60 };

async function requireAdminSession() {
  const session = await getServerSession();
  if (!session) throw unauthorized();
  if (session.role !== "admin") throw forbidden("Admin access required");
  return session;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession();
    await enforceRateLimit(ADMIN_UPLOADS, session.userId);

    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new HttpError(413, "This image is too large. Images must be under 4 MB after resizing.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw badRequest("The upload could not be read. Try again.");
    }
    const files = form.getAll("file").filter((value): value is File => typeof value !== "string");
    if (files.length !== 1) throw badRequest("Send exactly one image per request.");
    const file = files[0];
    if (file.size === 0) throw badRequest("The image is empty.");
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "This image is too large. Images must be under 4 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const check = validateAttachment({
      // The content decides (magic bytes); the name only needs an image extension.
      name: `upload.${(file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "")}`,
      type: file.type,
      size: file.size,
      base64: buffer.toString("base64"),
    });
    if (!check.valid || !check.detectedMimeType || !RASTER_TYPES.has(check.detectedMimeType)) {
      throw badRequest("This file is not a JPG, PNG, WebP or GIF image.");
    }

    const uploaded = await uploadExerciseImage(buffer, check.detectedMimeType, session.userId);
    after(() => sweepPendingExerciseImages());
    return ok({ url: uploaded.url }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "POST /api/admin/exercises/images");
  }
}

/** Discards an upload the admin removed before saving (only if no exercise uses it). */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminSession();
    const { url } = parseWith(imageDiscardSchema, await readJson(request));
    if (!exerciseImagePublicId(url)) return ok({ destroyed: false });
    const failed = await destroyUnusedExerciseImages([url]);
    return ok({ destroyed: failed.length === 0 });
  } catch (err) {
    return errorResponse(err, "DELETE /api/admin/exercises/images");
  }
}
