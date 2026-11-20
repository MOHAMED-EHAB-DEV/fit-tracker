/**
 * Browser-only helpers that shrink photos before they are sent to the coach,
 * so a phone photo becomes a few hundred KB instead of several MB.
 */

export interface PreparedFile {
  base64: string;
  type: string;
  size: number;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Re-encodes an image as JPEG with its longest side at most `maxDimension`.
 * Returns null when the browser cannot decode it (e.g. HEIC on most
 * browsers) or when re-encoding would not make it smaller.
 */
export async function downscaleImage(
  file: Blob,
  maxDimension: number = 1600,
  quality: number = 0.82
): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return null;
    return blob.size < file.size || scale < 1 ? blob : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Reads a file for upload, shrinking photos first. */
export async function prepareUpload(file: File): Promise<PreparedFile> {
  const resized = await downscaleImage(file);
  const blob = resized || file;
  return {
    base64: await blobToBase64(blob),
    type: resized ? "image/jpeg" : file.type,
    size: blob.size,
  };
}
