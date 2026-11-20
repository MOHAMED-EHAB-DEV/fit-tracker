import { NextRequest, NextResponse } from "next/server";
import { etagForKey, getCachedImage, getImageCacheKey, setCachedImage } from "@/lib/image-proxy/cache";
import { getSupabaseCachedImage, setSupabaseCachedImage } from "@/lib/image-proxy/supabase";
import { sniffImageType } from "@/lib/image-proxy/sniff";
import { isAllowedImageSource } from "@/lib/image-proxy/allowed";
import { clientIp, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { HttpError } from "@/lib/api/errors";

/**
 * Caching proxy for PUBLIC catalog images (exercise photos).
 *
 * It is reachable without a session, so it is deliberately strict:
 *  - https only, exact host allow-list, no redirects followed;
 *  - Cloudinary URLs must belong to this app's cloud and be public uploads
 *    (private body photos are never proxied or cached here);
 *  - the body is size-capped and must be a raster image by its first bytes
 *    (SVG and anything else is refused), and the response is locked down
 *    with nosniff + a sandboxing CSP.
 */

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ORIGIN_TIMEOUT_MS = 12_000;

function parseSource(segments: string[]): URL | null {
  try {
    let decoded = decodeURIComponent(segments.join("/"));
    // Path normalisation can collapse "https://" to "https:/".
    decoded = decoded.replace(/^(https?):\/+/i, "$1://");
    return new URL(decoded);
  } catch {
    return null;
  }
}

function imageResponse(buffer: Buffer, key: string, cacheState: string): NextResponse {
  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    return new NextResponse("Unsupported image", { status: 415 });
  }
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": sniffed.mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="image.${sniffed.ext}"`,
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etagForKey(key),
      "X-Cache": cacheState,
    },
  });
}

async function readCapped(response: Response): Promise<Buffer | null> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_IMAGE_BYTES) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function GET(request: NextRequest, context: { params: Promise<{ src: string[] }> }) {
  try {
    const { src } = await context.params;
    const source = parseSource(src);
    if (!source) return new NextResponse("Invalid image URL", { status: 400 });
    if (!isAllowedImageSource(source)) return new NextResponse("Image source not allowed", { status: 403 });

    const key = getImageCacheKey(source.href);

    if (request.headers.get("if-none-match") === etagForKey(key)) {
      return new NextResponse(null, { status: 304 });
    }

    const local = getCachedImage(key);
    if (local) return imageResponse(local, key, "HIT-local");

    const stored = await getSupabaseCachedImage(key);
    if (stored && sniffImageType(stored)) {
      setCachedImage(key, stored);
      return imageResponse(stored, key, "HIT-storage");
    }

    // Only a cache miss costs anything (an outside fetch and a storage write),
    // so only misses count against the per-address limit.
    try {
      await enforceRateLimit(RATE_LIMITS.imageProxyPerMinute, clientIp(request));
    } catch (err) {
      if (err instanceof HttpError && err.status === 429) {
        return new NextResponse("Too many image requests", { status: 429, headers: { "Retry-After": "60" } });
      }
      // The limiter's store is unreachable: serve the image rather than break every page.
    }

    let origin: Response;
    try {
      origin = await fetch(source.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      });
    } catch {
      return new NextResponse("Image could not be loaded", { status: 502 });
    }

    if (origin.status !== 200) {
      return new NextResponse("Image could not be loaded", { status: origin.status === 404 ? 404 : 502 });
    }

    const buffer = await readCapped(origin).catch(() => null);
    if (!buffer) return new NextResponse("Image is too large or unreadable", { status: 413 });
    if (!sniffImageType(buffer)) return new NextResponse("Unsupported image", { status: 415 });

    setCachedImage(key, buffer);
    await setSupabaseCachedImage(key, buffer).catch(() => undefined);

    return imageResponse(buffer, key, "MISS");
  } catch (err) {
    console.error("Image proxy error:", err);
    return new NextResponse("Image proxy error", { status: 500 });
  }
}
