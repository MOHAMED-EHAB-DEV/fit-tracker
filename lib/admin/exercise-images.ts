import "server-only";
import cloudinary from "@/lib/cloudinary";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import { imageSourceProblem, type ImageSourceProblem } from "@/lib/image-proxy/allowed";
import { escapeRegex } from "@/lib/validation/admin";

/**
 * Exercise image rules and Cloudinary housekeeping.
 *
 * Users see exercise images through the app's image proxy
 * (app/fit-tracker/images), so an image is only accepted when that proxy can
 * serve it. The rules themselves live in lib/image-proxy/allowed.ts, which
 * the proxy uses too.
 */

export const EXERCISE_IMAGE_FOLDER = "fit-tracker/exercises";
/** Tag on uploads that no saved exercise uses yet; removed when an exercise is saved. */
export const PENDING_TAG = "exercise-image-pending";
const PROBLEM_TEXT: Record<ImageSourceProblem, string> = {
  invalid: "is not a valid URL",
  not_https: "must start with https://",
  credentials_or_port: "must not contain a user name, password or port",
  has_query: "must not contain ? or # parts",
  user_photo: "is a user's private meal or progress photo, which cannot be used as an exercise image",
  host_not_allowed:
    "is on a site the app's image proxy does not serve. Upload the file instead, or use raw.githubusercontent.com",
  foreign_or_private_cloudinary:
    "is a Cloudinary image from another account or a private image. Upload the file instead",
  not_an_image_path: "must point directly to a .jpg, .png, .gif, .webp or .avif file",
};

/** Returns why an image URL cannot be used, or null when it is fine. */
export function exerciseImageUrlProblem(raw: string): string | null {
  const problem = imageSourceProblem(raw);
  return problem ? PROBLEM_TEXT[problem] : null;
}

/**
 * The Cloudinary public id of one of this app's exercise uploads, or null for
 * any other URL (external images are never destroyed).
 */
export function exerciseImagePublicId(raw: string): string | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hostname !== "res.cloudinary.com") return null;
  const prefix = `/${cloudName}/image/upload/`;
  if (!url.pathname.startsWith(prefix)) return null;
  const rest = url.pathname
    .slice(prefix.length)
    .split("/")
    .filter((segment) => !/^v\d+$/.test(segment));
  const path = decodeURIComponent(rest.join("/")).replace(/\.[a-z0-9]+$/i, "");
  return path.startsWith(`${EXERCISE_IMAGE_FOLDER}/`) ? path : null;
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export async function uploadExerciseImage(buffer: Buffer, mime: string, uploadedBy: string): Promise<UploadedImage> {
  const isGif = mime === "image/gif";
  const result = await cloudinary.uploader.upload(`data:${mime};base64,${buffer.toString("base64")}`, {
    folder: EXERCISE_IMAGE_FOLDER,
    resource_type: "image",
    tags: [PENDING_TAG],
    context: { uploaded_by: uploadedBy },
    ...(isGif ? {} : { format: "webp" }),
  });
  if (!result?.secure_url || !result.public_id) throw new Error("Cloudinary returned no URL");
  return { url: result.secure_url, publicId: result.public_id };
}

/** Marks uploads as used by a saved exercise so the pending sweep never removes them. */
export async function markExerciseImagesSaved(urls: readonly string[]): Promise<void> {
  const ids = urls.map(exerciseImagePublicId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  try {
    await cloudinary.uploader.remove_tag(PENDING_TAG, ids);
  } catch (err) {
    // Harmless: the sweep checks the database before destroying anything.
    console.warn("[exercise-images] could not clear the pending tag", err);
  }
}

/**
 * Destroys this app's uploads among `urls` that no exercise references.
 * Never throws; returns the URLs that could not be destroyed.
 */
export async function destroyUnusedExerciseImages(urls: readonly string[]): Promise<string[]> {
  const candidates = Array.from(new Set(urls)).filter((url) => exerciseImagePublicId(url));
  if (candidates.length === 0) return [];
  await getDb();
  const failed: string[] = [];
  const handled = new Set<string>();
  for (const url of candidates) {
    const publicId = exerciseImagePublicId(url)!;
    if (handled.has(publicId)) continue;
    handled.add(publicId);
    if (await isExerciseImageInUse(publicId)) continue;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    } catch (err) {
      console.warn("[exercise-images] could not destroy", publicId, err);
      failed.push(url);
    }
  }
  return failed;
}

/**
 * Whether any exercise still shows this asset, however its URL is spelled
 * (with or without the "v123" version segment or the file extension).
 */
async function isExerciseImageInUse(publicId: string): Promise<boolean> {
  const pattern = new RegExp(`/${escapeRegex(publicId)}(\\.[a-z0-9]+)?$`, "i");
  return Boolean(await ExerciseCatalog.exists({ images: pattern }));
}

const SWEEP_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweepAt = 0;

/**
 * Removes uploads that were never saved into an exercise (the admin closed the
 * tab, or the save failed and was abandoned). Runs at most once an hour per
 * server instance and only touches uploads older than a day.
 */
export async function sweepPendingExerciseImages(now: number = Date.now()): Promise<void> {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  try {
    const result = (await cloudinary.api.resources_by_tag(PENDING_TAG, {
      resource_type: "image",
      max_results: 100,
    })) as { resources?: Array<{ public_id: string; secure_url: string; created_at: string }> };
    const old = (result.resources || []).filter(
      (resource) => now - new Date(resource.created_at).getTime() > SWEEP_AGE_MS
    );
    if (old.length === 0) return;

    await getDb();
    const usedIds: string[] = [];
    for (const resource of old) {
      if (await isExerciseImageInUse(resource.public_id)) usedIds.push(resource.public_id);
    }
    if (usedIds.length) await cloudinary.uploader.remove_tag(PENDING_TAG, usedIds);
    for (const resource of old) {
      if (usedIds.includes(resource.public_id)) continue;
      await cloudinary.uploader.destroy(resource.public_id, { resource_type: "image", invalidate: true });
    }
  } catch (err) {
    console.warn("[exercise-images] pending sweep failed", err);
  }
}
