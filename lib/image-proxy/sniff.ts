/**
 * Identifies raster image formats from their first bytes. The image proxy
 * serves ONLY what this recognises, so an SVG or HTML file can never be
 * returned from the app's origin whatever the upstream server claims.
 */
export interface SniffedImage {
  mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif";
  ext: "jpg" | "png" | "gif" | "webp" | "avif";
}

function ascii(buffer: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...buffer.subarray(start, end));
}

export function sniffImageType(buffer: Uint8Array): SniffedImage | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  const head6 = ascii(buffer, 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") {
    return { mime: "image/gif", ext: "gif" };
  }
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (ascii(buffer, 4, 8) === "ftyp") {
    const brand = ascii(buffer, 8, 12);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif" };
  }
  return null;
}
