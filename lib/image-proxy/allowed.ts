/**
 * Which image addresses the public image proxy will serve. One definition,
 * used by the proxy itself and by every place that accepts an image URL
 * (so nothing is saved that users could not then see).
 */

const IMAGE_PATH_RE = /\.(jpe?g|png|gif|webp|avif)$/i;
const DEFAULT_HOSTS = ["res.cloudinary.com", "raw.githubusercontent.com"];

export type ImageSourceProblem =
  | "invalid"
  | "not_https"
  | "credentials_or_port"
  | "has_query"
  | "host_not_allowed"
  | "foreign_or_private_cloudinary"
  | "user_photo"
  | "not_an_image_path";

/**
 * Folders that hold users' own photos (meals, body check-ins). They are never
 * fetched or cached by the public proxy, so a deleted photo is not kept there.
 */
const USER_PHOTO_FOLDER_RE = /(^|\/)fit-tracker\/(meals|body-comp)(\/|$)/;

/** Hosts the proxy fetches from: the defaults plus IMAGE_PROXY_ALLOWED_HOSTS (exact names only). */
export function allowedImageHosts(): string[] {
  const fromEnv = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    // A wildcard would turn the proxy into an open relay; it is ignored.
    .filter((host) => host && !host.includes("*") && host.includes("."));
  return Array.from(new Set([...DEFAULT_HOSTS, ...fromEnv]));
}

/** Why the proxy refuses a source, or null when it is served. */
export function imageSourceProblem(source: URL | string): ImageSourceProblem | null {
  let url: URL;
  try {
    url = typeof source === "string" ? new URL(source) : source;
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:") return "not_https";
  if (url.username || url.password || url.port) return "credentials_or_port";
  // One cache entry per image: a query string would let anyone create endless copies.
  if (url.search || url.hash) return "has_query";

  const host = url.hostname.toLowerCase();
  if (!allowedImageHosts().includes(host)) return "host_not_allowed";

  if (host === "res.cloudinary.com") {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    // Only this app's public uploads: /<cloud>/image/upload/...
    if (!cloudName || !url.pathname.startsWith(`/${cloudName}/image/upload/`)) return "foreign_or_private_cloudinary";
    if (USER_PHOTO_FOLDER_RE.test(decodeURIComponent(url.pathname))) return "user_photo";
    return null;
  }

  return IMAGE_PATH_RE.test(url.pathname) ? null : "not_an_image_path";
}

export function isAllowedImageSource(source: URL | string): boolean {
  return imageSourceProblem(source) === null;
}
