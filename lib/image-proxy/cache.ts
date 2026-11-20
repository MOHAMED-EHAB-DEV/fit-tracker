import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// The OS temp directory is the only writable location on serverless hosts.
const CACHE_DIR = path.join(os.tmpdir(), "fit-tracker-image-cache");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function ensureCacheDir(): boolean {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/** One cache entry per source URL (the proxy does not resize). */
export function getImageCacheKey(src: string): string {
  return crypto.createHash("sha256").update(src).digest("hex");
}

export function etagForKey(key: string): string {
  return `"${key.slice(0, 32)}"`;
}

export function getCachedImage(key: string): Buffer | null {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.bin`);
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (Date.now() - stats.mtimeMs >= MAX_AGE_MS) {
      fs.unlinkSync(filePath);
      return null;
    }
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

export function setCachedImage(key: string, buffer: Buffer): void {
  try {
    if (!ensureCacheDir()) return;
    const tempPath = path.join(CACHE_DIR, `${key}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, path.join(CACHE_DIR, `${key}.bin`)); // Atomic write
  } catch {
    // The cache is an optimisation; a failed write must never break a request.
  }
}
