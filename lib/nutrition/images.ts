import "server-only";
import type { UploadApiResponse } from "cloudinary";
import cloudinary from "@/lib/cloudinary";
import Meal, { type IMealImage } from "@/lib/db/models/Meal";
import { HttpError } from "@/lib/api/errors";
import { validateImageBuffer } from "@/lib/security/file-validator";
import { getImageCacheKey } from "@/lib/image-proxy/cache";
import { deleteSupabaseCachedImage } from "@/lib/image-proxy/supabase";
import {
  canTouchMealImage,
  isLegacySharedMealImage,
  isOwnedMealImage,
  mealImageFolder,
} from "@/lib/nutrition/image-rules";

/**
 * Meal photo storage. Uploads go to the user's own folder; metadata always
 * comes from Cloudinary's upload response (never from the browser); reads and
 * deletes are limited to assets the ownership rule allows.
 */

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_BYTES = 8 * 1024 * 1024;

async function uploadOne(userId: string, buffer: Buffer): Promise<IMealImage> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: mealImageFolder(userId),
        resource_type: "image",
        type: "upload",
        format: "webp",
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, response) => {
        if (error || !response) reject(error || new Error("Cloudinary upload failed"));
        else resolve(response);
      }
    );
    stream.end(buffer);
  });

  if (!isOwnedMealImage(result.public_id, userId)) {
    await cloudinary.uploader.destroy(result.public_id, { resource_type: "image", invalidate: true }).catch(() => undefined);
    throw new Error(`Unexpected upload location: ${result.public_id}`);
  }

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    deliveryType: "upload",
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
}

/** Uploads every photo or none: on any failure the ones already stored are removed. */
export async function uploadMealPhotos(userId: string, buffers: Buffer[]): Promise<IMealImage[]> {
  const settled = await Promise.allSettled(buffers.map((buffer) => uploadOne(userId, buffer)));
  const stored = settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
  if (stored.length === buffers.length) return stored;

  for (const entry of settled) {
    if (entry.status === "rejected") console.error("[meals] photo upload failed:", entry.reason);
  }
  await destroyMealImages(userId, stored);
  throw new HttpError(502, "Your photo could not be saved. Please try again.");
}

/**
 * Removes a meal's photos from storage (best effort; failures are logged).
 * Only assets in the user's folder, or in the old shared meals folder and not
 * used by any other meal, are touched.
 */
export async function destroyMealImages(
  userId: string,
  images:
    | ReadonlyArray<{ publicId?: string | null; deliveryType?: string | null; secureUrl?: string | null }>
    | null
    | undefined,
  deletedMealId?: string
): Promise<{ failed: number }> {
  let failed = 0;
  for (const image of images || []) {
    const publicId = image?.publicId;
    if (!publicId || !canTouchMealImage(publicId, userId)) {
      if (publicId) console.warn("[meals] refusing to delete an image outside the user's meal folder");
      continue;
    }
    if (isLegacySharedMealImage(publicId)) {
      const filter: Record<string, unknown> = { "images.publicId": publicId };
      if (deletedMealId) filter._id = { $ne: deletedMealId };
      const stillUsed = await Meal.exists(filter);
      if (stillUsed) continue;
    }
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        // Old meals may hold private assets; destroy needs the matching type.
        type: image.deliveryType === "private" ? "private" : "upload",
        invalidate: true,
      });
    } catch (err) {
      console.error("[meals] could not delete a meal photo:", err);
      failed++;
    }
    // Older versions showed meal photos through the public image proxy, which
    // kept a copy in storage; remove it too.
    if (image.secureUrl) {
      try {
        await deleteSupabaseCachedImage(getImageCacheKey(new URL(image.secureUrl).href));
      } catch {
        // Not a valid URL: nothing was cached under it.
      }
    }
  }
  return { failed };
}

/**
 * Reads a stored meal photo back for re-analysis. The URL is rebuilt from the
 * public id with the server's Cloudinary account (no client URL is fetched),
 * with a timeout and a size cap.
 */
export async function loadMealImageForAnalysis(
  userId: string,
  image: { publicId?: string | null; deliveryType?: string | null }
): Promise<{ data: string; mimeType: string }> {
  const publicId = image.publicId || "";
  if (!canTouchMealImage(publicId, userId)) throw new Error("Image is outside the user's meal folder");

  const isPrivate = image.deliveryType === "private";
  const url = cloudinary.url(publicId, {
    secure: true,
    resource_type: "image",
    type: isPrivate ? "private" : "upload",
    sign_url: isPrivate,
  });
  if (new URL(url).hostname !== "res.cloudinary.com") throw new Error("Unexpected image host");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok || !response.body) throw new Error(`Image fetch failed with ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > FETCH_MAX_BYTES) throw new Error("Stored image is too large");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > FETCH_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Stored image is too large");
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  const check = validateImageBuffer(buffer, { maxBytes: FETCH_MAX_BYTES });
  if (!check.valid) throw new Error(check.error);
  return { data: buffer.toString("base64"), mimeType: check.mimeType };
}
