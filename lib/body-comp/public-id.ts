/**
 * Recovers the Cloudinary asset identity from a delivery URL, for check-ins
 * saved before only the public id was stored (pure, no SDK).
 *
 *   https://res.cloudinary.com/<cloud>/image/private/s--sig--/v1712/fit-tracker/body-comp/abc.webp
 *   -> { publicId: "fit-tracker/body-comp/abc", deliveryType: "private", format: "webp" }
 */

export type DeliveryType = "upload" | "private" | "authenticated";

export interface CloudinaryAssetRef {
  publicId: string;
  deliveryType: DeliveryType;
  format: string | null;
}

const DELIVERY_RE = /\/image\/(upload|private|authenticated)\/(.+)$/;
const SIGNATURE_RE = /^s--[A-Za-z0-9_-]+--$/;
const VERSION_RE = /^v\d+$/;
const TRANSFORMATION_RE = /^([a-z]{1,3}_[^/]+)(,[a-z]{1,3}_[^/]+)*$/;

export function parseCloudinaryUrl(url: unknown): CloudinaryAssetRef | null {
  if (typeof url !== "string" || !url) return null;
  let pathname: string;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)cloudinary\.com$/.test(parsed.hostname)) return null;
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  const match = DELIVERY_RE.exec(pathname);
  if (!match) return null;
  const deliveryType = match[1] as DeliveryType;
  let segments = match[2].split("/").filter(Boolean);

  if (segments[0] && SIGNATURE_RE.test(segments[0])) segments = segments.slice(1);
  const versionIndex = segments.findIndex((s) => VERSION_RE.test(s));
  if (versionIndex >= 0) {
    segments = segments.slice(versionIndex + 1);
  } else {
    while (segments.length > 1 && TRANSFORMATION_RE.test(segments[0])) segments = segments.slice(1);
  }
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1];
  const dot = last.lastIndexOf(".");
  const format = dot > 0 ? last.slice(dot + 1).toLowerCase() : null;
  segments[segments.length - 1] = dot > 0 ? last.slice(0, dot) : last;
  const publicId = segments.join("/");
  return publicId ? { publicId, deliveryType, format } : null;
}
