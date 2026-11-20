import "server-only";
import crypto from "node:crypto";

/**
 * Encryption for user-supplied secrets stored in the database
 * (currently the personal Gemini API key).
 *
 * AES-256-GCM with a key derived from DATA_ENCRYPTION_KEY (preferred) or
 * JWT_SECRET. Stored format: "enc:v1:<iv>:<tag>:<ciphertext>" (base64url).
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("DATA_ENCRYPTION_KEY or JWT_SECRET must be configured");
  }
  return Buffer.from(
    crypto.hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from("fit-tracker", "utf8"), Buffer.from("user-secrets-v1", "utf8"), 32)
  );
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

/**
 * Returns the plain value, or null when it cannot be decrypted (for example
 * after the encryption key changed). Values saved before encryption existed
 * are returned as they are.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) return stored;
  try {
    const [ivText, tagText, dataText] = stored.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

/** SHA-256 hex digest, used to store one-time tokens without keeping the token itself. */
export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** A URL-safe random token. */
export function randomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
