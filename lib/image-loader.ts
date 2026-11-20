/**
 * next/image loader. Public catalog images go through the app's caching
 * image proxy; everything else is used as it is.
 *
 * The proxy does not resize, so the width is intentionally not part of the
 * URL: one cached copy per image instead of one per screen size.
 */
function isPrivateOrSigned(src: string): boolean {
  return (
    src.includes("/image/private/") ||
    src.includes("/image/authenticated/") ||
    src.includes("/image/download") ||
    /[?&](signature|expires_at|token)=/.test(src)
  );
}

/** Meal and progress photos (same rule as the proxy's allow-list; kept dependency-free for the browser). */
function isUserPhoto(src: string): boolean {
  return src.includes("res.cloudinary.com/") && /\/fit-tracker\/(meals|body-comp)(\/|$)/.test(src);
}

export default function fitImageLoader({ src }: { src: string; width: number; quality?: number }) {
  if (!src) return "";
  if (
    src.startsWith("/fit-tracker/images/") ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    (src.startsWith("/") && !src.startsWith("//"))
  ) {
    return src;
  }
  // Users' photos (private or not) must never enter the public proxy cache.
  if (isPrivateOrSigned(src) || isUserPhoto(src)) return src;
  return `/fit-tracker/images/${encodeURIComponent(src)}`;
}
