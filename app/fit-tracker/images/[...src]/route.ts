import { NextRequest, NextResponse } from "next/server";
import {
  getImageCacheKey,
  getCachedImage,
  setCachedImage,
} from "@/lib/image-proxy/cache";
import {
  getSupabaseCachedImage,
  setSupabaseCachedImage,
} from "@/lib/image-proxy/supabase";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ src: string[] }> }
) {
  try {
    const { src: srcParam } = await context.params;
    const rawSrc = srcParam.join("/");
    const decodedSrc = decodeURIComponent(rawSrc);

    const { searchParams } = new URL(request.url);
    const widthParam = searchParams.get("w");
    const qualityParam = searchParams.get("q");

    const width = widthParam ? parseInt(widthParam, 10) : undefined;
    const quality = qualityParam ? parseInt(qualityParam, 10) : 80;

    // Security check: only allow approved hosts
    const allowedHosts = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || "res.cloudinary.com").split(",");
    try {
      const parsedUrl = new URL(decodedSrc);
      const isAllowed = allowedHosts.some((h) => parsedUrl.hostname.includes(h.trim()));
      if (!isAllowed) {
        return new NextResponse("Forbidden image source host", { status: 403 });
      }
    } catch {
      return new NextResponse("Invalid image source URL", { status: 400 });
    }

    const cacheKey = getImageCacheKey(decodedSrc, width, quality);

    // Layer 1 & 2: Local disk cache + ETag check
    const localHit = getCachedImage(cacheKey);
    if (localHit) {
      const clientEtag = request.headers.get("if-none-match");
      if (clientEtag === localHit.etag) {
        return new NextResponse(null, { status: 304 });
      }

      return new NextResponse(new Uint8Array(localHit.buffer), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
          ETag: localHit.etag,
          "X-Cache": "HIT",
          "X-Storage-Backend": "local-disk",
        },
      });
    }

    // Layer 3: Supabase Storage persistent cache
    const supabaseHit = await getSupabaseCachedImage(cacheKey);
    if (supabaseHit) {
      setCachedImage(cacheKey, supabaseHit); // populate local disk
      const etag = `"${cacheKey.slice(0, 32)}"`;

      return new NextResponse(new Uint8Array(supabaseHit), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
          ETag: etag,
          "X-Cache": "HIT",
          "X-Storage-Backend": "supabase",
        },
      });
    }

    // Layer 4: Fetch origin
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const originRes = await fetch(decodedSrc, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!originRes.ok) {
      return new NextResponse("Failed to fetch image from origin", {
        status: originRes.status,
      });
    }

    const contentType = originRes.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Origin did not return an image", { status: 400 });
    }

    const arrayBuffer = await originRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to caches in the background
    setCachedImage(cacheKey, buffer);
    setSupabaseCachedImage(cacheKey, buffer).catch((e) =>
      console.error("Supabase async save error:", e)
    );

    const etag = `"${cacheKey.slice(0, 32)}"`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/webp",
        "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
        ETag: etag,
        "X-Cache": "MISS",
        "X-Storage-Backend": "origin",
      },
    });
  } catch (err: any) {
    console.error("Image proxy error:", err);
    return new NextResponse(`Image proxy error: ${err.message}`, { status: 500 });
  }
}
