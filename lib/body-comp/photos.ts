import "server-only";
import cloudinary from "@/lib/cloudinary";
import { HttpError, badRequest } from "@/lib/api/errors";
import { validateAttachment } from "@/lib/security/file-validator";
import { parseCloudinaryUrl, type DeliveryType } from "@/lib/body-comp/public-id";
import type { IBodyPhoto } from "@/lib/db/models/BodyComp";

/**
 * Body photos are uploaded as Cloudinary "private" assets. The browser only
 * ever receives short-lived signed download URLs created on each
 * authenticated read; nothing public is stored or cached.
 */

export const PHOTO_FOLDER = "fit-tracker/body-comp";
export const PHOTO_URL_TTL_SECONDS = 15 * 60;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const PHOTO_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface ValidatedPhoto {
  buffer: Buffer;
  /** Detected from the file's bytes, not from the client's claim. */
  mimeType: string;
}

/** Size, type and magic-byte checks. Throws a 400 with a user-facing message. */
export async function validatePhotoFile(file: File): Promise<ValidatedPhoto> {
  if (file.size === 0) throw badRequest("The photo is empty.");
  if (file.size > MAX_PHOTO_BYTES) throw new HttpError(413, "The photo is too large (max 8 MB).");
  const declared = (file.type || "").toLowerCase();
  const extension = PHOTO_MIME_TYPES[declared];
  if (!extension) throw badRequest("Please upload a JPEG, PNG or WebP photo.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = validateAttachment({
    name: `photo.${extension}`,
    type: declared,
    size: buffer.length,
    base64: buffer.toString("base64"),
  });
  const detected = result.detectedMimeType || "";
  if (!result.valid || !PHOTO_MIME_TYPES[detected]) {
    throw badRequest("That file is not a valid JPEG, PNG or WebP image.");
  }
  return { buffer, mimeType: detected };
}

export interface UploadedPhoto {
  publicId: string;
  format: string;
}

export async function uploadPrivatePhoto(buffer: Buffer): Promise<UploadedPhoto> {
  const result = await new Promise<{ public_id: string; format?: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: PHOTO_FOLDER, type: "private", resource_type: "image", format: "webp" },
      (err, res) => (err || !res ? reject(err || new Error("Empty upload response")) : resolve(res))
    );
    stream.end(buffer);
  });
  return { publicId: result.public_id, format: result.format || "webp" };
}

interface ResolvedPhoto {
  publicId: string;
  deliveryType: DeliveryType;
  format: string;
}

/** Public id / type / format, recovering them from legacy secure URLs when needed. */
export function resolvePhoto(photo: Partial<IBodyPhoto>): ResolvedPhoto | null {
  const fromUrl = parseCloudinaryUrl(photo.signedUrl);
  const publicId = photo.cloudinaryPublicId || fromUrl?.publicId;
  if (!publicId) return null;
  return {
    publicId,
    deliveryType: (photo.deliveryType as DeliveryType | undefined) || fromUrl?.deliveryType || "private",
    format: photo.format || fromUrl?.format || "webp",
  };
}

/** A signed download URL valid for PHOTO_URL_TTL_SECONDS, or null if the asset is unknown. */
export function signPhotoUrl(
  photo: Partial<IBodyPhoto>,
  now: Date = new Date()
): { url: string; expiresAt: string } | null {
  const resolved = resolvePhoto(photo);
  if (!resolved) return null;
  const expiresAt = Math.floor(now.getTime() / 1000) + PHOTO_URL_TTL_SECONDS;
  const url = cloudinary.utils.private_download_url(resolved.publicId, resolved.format, {
    type: resolved.deliveryType,
    resource_type: "image",
    expires_at: expiresAt,
  });
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

/** Deletes the asset (and its CDN copies). "not found" counts as deleted. */
export async function destroyPhoto(photo: Partial<IBodyPhoto>): Promise<void> {
  const resolved = resolvePhoto(photo);
  if (!resolved) return;
  const result = (await cloudinary.uploader.destroy(resolved.publicId, {
    type: resolved.deliveryType,
    resource_type: "image",
    invalidate: true,
  })) as { result?: string };
  if (result?.result !== "ok" && result?.result !== "not found") {
    throw new Error(`Cloudinary destroy returned "${result?.result ?? "unknown"}"`);
  }
}

/** Best-effort cleanup for an upload whose check-in could not be saved. */
export async function destroyUploadedQuietly(publicId: string): Promise<void> {
  try {
    await destroyPhoto({ cloudinaryPublicId: publicId, deliveryType: "private" });
  } catch (err) {
    console.error("[body-comp] could not remove orphaned upload", publicId, err);
  }
}
