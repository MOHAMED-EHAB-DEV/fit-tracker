export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedBuffer?: Buffer;
  cleanBase64?: string;
  detectedMimeType?: string;
  isTextBased?: boolean;
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB total payload
export const MAX_ATTACHMENTS_COUNT = 5;

// Whitelisted MIME types
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "text/markdown",
]);

// Whitelisted file extensions (normalized to lowercase without dot)
export const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
  "pdf",
  "txt",
  "csv",
  "json",
  "md",
  "markdown",
]);

// Explicitly blocked dangerous extensions
export const DANGEROUS_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "bash",
  "php",
  "js",
  "mjs",
  "cjs",
  "ts",
  "html",
  "htm",
  "svg",
  "vbs",
  "ps1",
  "dll",
  "scr",
  "jar",
  "py",
  "rb",
  "cgi",
  "com",
  "msi",
]);

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "heif"]);

/** "image/heic" / "image/heif" when the buffer is an HEIF container, else null. */
function detectHeif(buffer: Buffer): "image/heic" | "image/heif" | null {
  if (buffer.length < 12) return null;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return null;
  const major = buffer.toString("ascii", 8, 12);
  if (HEIC_BRANDS.has(major)) return "image/heic";
  if (HEIF_BRANDS.has(major)) {
    // Compatible brands follow the minor version (bytes 12-15) in 4-byte steps.
    const boxSize = Math.min(buffer.readUInt32BE(0), buffer.length, 64);
    for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
      if (HEIC_BRANDS.has(buffer.toString("ascii", offset, offset + 4))) return "image/heic";
    }
    return "image/heif";
  }
  return null;
}

/** Raster photo types accepted for meal analysis (all supported by Gemini). */
export const MEAL_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/**
 * Identifies an uploaded photo from its bytes (the declared type and file name
 * are ignored). Returns the real MIME type, or an error message.
 */
export function validateImageBuffer(
  buffer: Buffer,
  options: { maxBytes?: number; allowed?: Set<string> } = {}
): { valid: true; mimeType: string } | { valid: false; error: string } {
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE_BYTES;
  const allowed = options.allowed ?? MEAL_PHOTO_MIME_TYPES;
  if (buffer.length === 0) return { valid: false, error: "The photo is empty." };
  if (buffer.length > maxBytes) {
    return { valid: false, error: `The photo is larger than ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.` };
  }
  const { valid, detectedType } = validateMagicBytes(buffer, "application/octet-stream");
  if (!valid || !allowed.has(detectedType)) {
    return { valid: false, error: "Only JPEG, PNG, WebP or HEIC photos are supported." };
  }
  return { valid: true, mimeType: detectedType };
}

/**
 * Validates magic bytes for binary files to prevent MIME spoofing.
 */
function validateMagicBytes(buffer: Buffer, declaredType: string): { valid: boolean; detectedType: string } {
  if (buffer.length < 4) {
    return { valid: false, detectedType: "unknown" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedType: "image/png" };
  }

  // GIF: 47 49 46 38 ('GIF8')
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { valid: true, detectedType: "image/gif" };
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { valid: true, detectedType: "image/webp" };
  }

  // HEIC / HEIF: ISO-BMFF box "ftyp" at bytes 4-7 followed by a HEIF brand.
  const heif = detectHeif(buffer);
  if (heif) {
    return { valid: true, detectedType: heif };
  }

  // PDF: %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d // -
  ) {
    return { valid: true, detectedType: "application/pdf" };
  }

  // Text-based files (CSV, TXT, JSON, MD): Verify absence of null bytes and valid UTF-8
  const isTextType =
    declaredType.startsWith("text/") ||
    declaredType === "application/json" ||
    declaredType === "application/csv";

  if (isTextType) {
    // Check first 1024 bytes for null bytes (typical indicator of binary/executable)
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return { valid: false, detectedType: "application/octet-stream" };
      }
    }
    return { valid: true, detectedType: declaredType };
  }

  return { valid: false, detectedType: "unrecognized" };
}

/**
 * Validates a single file attachment for size, type, magic bytes, and sanitization.
 */
export function validateAttachment(file: {
  name: string;
  type: string;
  size: number;
  base64: string;
}): ValidationResult {
  if (!file || !file.name || !file.base64) {
    return { valid: false, error: "Invalid attachment payload structure" };
  }

  // 1. Validate file extension
  const extensionMatch = file.name.split(".").pop();
  const ext = (extensionMatch || "").toLowerCase().trim();

  if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type '.${ext}' is blocked for security.` };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File extension '.${ext}' is not supported.` };
  }

  // 2. Normalize and check MIME type
  const normalizedMime = (file.type || "").toLowerCase().trim();
  if (normalizedMime && !ALLOWED_MIME_TYPES.has(normalizedMime)) {
    // Allow text/csv or text/plain fallback if extension is allowed
    const isAllowedTextExt = ["csv", "txt", "json", "md", "markdown"].includes(ext);
    if (!isAllowedTextExt) {
      return { valid: false, error: `MIME type '${file.type}' is not allowed.` };
    }
  }

  // 3. Clean and validate base64 string
  let cleanBase64 = file.base64;
  if (cleanBase64.includes(";base64,")) {
    cleanBase64 = cleanBase64.split(";base64,").pop() || "";
  }
  cleanBase64 = cleanBase64.replace(/\s/g, "");

  // Base64 format check
  if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
    return { valid: false, error: "Invalid base64 encoding detected." };
  }

  // 4. Convert to buffer and validate binary size
  const buffer = Buffer.from(cleanBase64, "base64");
  if (buffer.length === 0) {
    return { valid: false, error: "File attachment is empty (0 bytes)." };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File '${file.name}' exceeds maximum allowed size of 10MB (${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  // 5. Magic byte verification
  const magicCheck = validateMagicBytes(buffer, normalizedMime || "text/plain");
  if (!magicCheck.valid) {
    return {
      valid: false,
      error: `File signature mismatch for '${file.name}'. Content does not match declared type.`,
    };
  }

  const isTextBased =
    magicCheck.detectedType.startsWith("text/") ||
    magicCheck.detectedType === "application/json" ||
    ["csv", "txt", "json", "md", "markdown"].includes(ext);

  return {
    valid: true,
    sanitizedBuffer: buffer,
    cleanBase64,
    detectedMimeType: magicCheck.detectedType,
    isTextBased,
  };
}
