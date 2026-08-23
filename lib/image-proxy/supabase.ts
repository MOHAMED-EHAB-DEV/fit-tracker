const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "fit-tracker-images";

/**
 * Checks and downloads a cached processed image from Supabase Storage.
 */
export async function getSupabaseCachedImage(key: string): Promise<Buffer | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/processed/${key}.webp`;
    const res = await fetch(url);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.error("Supabase cache fetch error:", err);
  }
  return null;
}

/**
 * Uploads a processed image buffer to Supabase Storage (fire-and-forget).
 */
export async function setSupabaseCachedImage(key: string, buffer: Buffer): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/processed/${key}.webp`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/webp",
        "x-upsert": "true",
      },
      body: new Uint8Array(buffer),
    });
  } catch (err) {
    console.error("Supabase cache upload error:", err);
  }
}
