import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache", "images");

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    return false;
  }
}


export function getImageCacheKey(src: string, width?: number, quality?: number): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${src}_w${width || "orig"}_q${quality || 80}`)
    .digest("hex");
  return hash;
}

export function getCachedImage(key: string): { buffer: Buffer; etag: string } | null {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.webp`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const now = Date.now();
      const ageMs = now - stats.mtimeMs;
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (ageMs < MAX_AGE_MS) {
        const buffer = fs.readFileSync(filePath);
        const etag = `"${key.slice(0, 32)}"`;
        return { buffer, etag };
      } else {
        // Expired — remove
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error("Cache read error:", err);
  }
  return null;
}

export function setCachedImage(key: string, buffer: Buffer): void {
  try {
    if (!ensureCacheDir()) return;
    const tempPath = path.join(CACHE_DIR, `${key}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    const finalPath = path.join(CACHE_DIR, `${key}.webp`);
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, finalPath); // Atomic write
  } catch (err) {
    console.error("Cache write error:", err);
  }
}
