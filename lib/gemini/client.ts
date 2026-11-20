import "server-only";
import {
  GoogleGenAI,
  type ContentListUnion,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/security/rate-limit";
import { getUserGeminiKey } from "@/lib/users/profile";
import {
  MODEL_CHAINS,
  modelCooldownMs,
  modelsToTry,
  shouldTryNextModel,
  type AiTask,
  type GeminiModelId,
} from "@/lib/gemini/models";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenAI({ apiKey });

/**
 * AI Power Modes:
 * - "full": Full power AI with NO output token limits (unconstrained reasoning and output).
 * - "balanced": Standard token limits (e.g., 2048–3000 tokens).
 * - "low": Restricted token limits (e.g., 512–1024 tokens) for lightweight/eco output.
 */
export type AIPowerMode = "full" | "balanced" | "low";

/**
 * Global AI Power setting.
 * Adjust via environment variable `AI_POWER_MODE` or dynamically via `setAIPowerMode`.
 * Default is "full".
 */
export let AI_POWER_MODE: AIPowerMode =
  (process.env.AI_POWER_MODE as AIPowerMode) || "full";

export function setAIPowerMode(mode: AIPowerMode): void {
  AI_POWER_MODE = mode;
}

export function getAIPowerMode(): AIPowerMode {
  return AI_POWER_MODE;
}

/**
 * Resolves max output tokens based on active power mode.
 * In "full" power mode, returns undefined so no token limit is imposed on the AI.
 */
export function resolveMaxOutputTokens(
  defaultLimit?: number,
  overrideMode?: AIPowerMode
): number | undefined {
  const mode = overrideMode || AI_POWER_MODE;
  if (mode === "full") {
    // "Full" is generous, never unlimited: an uncapped response is an
    // uncapped bill.
    return Math.min(16_384, Math.max(8_192, (defaultLimit || 2048) * 4));
  }
  if (mode === "low") {
    return defaultLimit
      ? Math.max(256, Math.min(Math.round(defaultLimit / 2), 1024))
      : 768;
  }
  // "balanced" mode
  return defaultLimit || 2048;
}

export interface GeminiConfigOptions {
  systemInstruction?: string;
  responseMimeType?: string;
  /** A JSON schema object as the Gemini API expects it. */
  responseSchema?: unknown;
  maxOutputTokens?: number;
  powerMode?: AIPowerMode;
  temperature?: number;
}

/**
 * Constructs a Gemini model configuration respecting the active AI power mode.
 */
export function createGeminiConfig(options: GeminiConfigOptions) {
  const {
    systemInstruction,
    responseMimeType,
    responseSchema,
    maxOutputTokens: customLimit,
    powerMode,
    temperature,
  } = options;

  const resolvedTokens = resolveMaxOutputTokens(customLimit, powerMode);

  const config: Record<string, unknown> = {};

  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (responseSchema) config.responseSchema = responseSchema;
  if (typeof temperature === "number") config.temperature = temperature;
  if (typeof resolvedTokens === "number") config.maxOutputTokens = resolvedTokens;

  return config;
}

/**
 * Each AI route allows 60 seconds; the whole chain must finish inside that,
 * with room left for the work before it (reading photos, loading context).
 */
const TOTAL_BUDGET_MS = 45_000;
const FIRST_ATTEMPT_TIMEOUT_MS = 30_000;
const LATER_ATTEMPT_TIMEOUT_MS = 20_000;
/** Not worth starting an attempt with less time than this left. */
const MIN_ATTEMPT_MS = 5_000;

/** An AI failure whose message was written for the user and may be shown as it is. */
export class AiUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUserError";
  }
}

/** The provider refused the API key itself (invalid, expired, not allowed). */
function isApiKeyError(error: unknown): boolean {
  const err = error as { status?: number | string; message?: string } | null;
  const message = String(err?.message || "").toLowerCase();
  return (
    message.includes("api key not valid") ||
    message.includes("api_key_invalid") ||
    message.includes("api key expired") ||
    message.includes("api_key_expired") ||
    message.includes("invalid api key") ||
    (String(err?.status) === "403" && message.includes("permission"))
  );
}

/** Models to skip for a while, per key: "server:gemini-4-argon" -> time the skip ends. */
const modelCooldowns = new Map<string, number>();

function isCoolingDown(keyId: string, model: GeminiModelId): boolean {
  const cooldownKey = `${keyId}:${model}`;
  const until = modelCooldowns.get(cooldownKey);
  if (!until) return false;
  if (until <= Date.now()) {
    modelCooldowns.delete(cooldownKey);
    return false;
  }
  return true;
}

/**
 * Runs generateContent for a user, with:
 *  - per-user rate limits (per minute always; per day when the shared server
 *    key is used), counted once per request, not once per model tried,
 *  - the user's personal Gemini key when they saved one,
 *  - a capped output size and a timeout on every call,
 *  - the model chain for the task (see lib/gemini/models.ts): each model is
 *    tried in order until one answers. Models the key cannot use are
 *    remembered and skipped on later requests.
 */
export async function generateContentWithFallback(options: {
  /** The signed-in user the call is made for. */
  userId: string;
  /** What the request is for; decides which models are tried, in which order. */
  task: AiTask;
  /** Message parts in the Gemini SDK's format. */
  contents: unknown;
  config?: GenerateContentConfig | Record<string, unknown>;
  /** Optional explicit key; by default the user's saved key (or the server key) is used. */
  apiKey?: string;
}): Promise<{ text: string | undefined; modelUsed: string; response: GenerateContentResponse }> {
  const personalKey = options.apiKey?.trim() || (await getUserGeminiKey(options.userId)) || undefined;

  await enforceRateLimit(RATE_LIMITS.aiPerMinute, options.userId);
  if (!personalKey) {
    await enforceRateLimit(RATE_LIMITS.aiPerDay, options.userId);
    if (!apiKey) {
      throw new AiUserError("AI is not configured on this server. Add your own Gemini API key in Settings.");
    }
  }
  const keyRejected = () =>
    new AiUserError(
      personalKey
        ? "Your Gemini API key was rejected (invalid or expired). Check it in Settings, or remove it to use the shared key."
        : "The AI service is not available right now. Please try again later, or add your own Gemini API key in Settings."
    );

  const client = personalKey ? new GoogleGenAI({ apiKey: personalKey }) : genAI;
  const keyId = personalKey ? `user:${options.userId}` : "server";
  const baseConfig: GenerateContentConfig = { ...((options.config as GenerateContentConfig) || {}) };
  if (typeof baseConfig.maxOutputTokens !== "number") {
    baseConfig.maxOutputTokens = resolveMaxOutputTokens(2048);
  }

  const models = modelsToTry(MODEL_CHAINS[options.task], (model) => isCoolingDown(keyId, model));
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown = new Error("AI request timed out. Please try again.");

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const timeoutMs = Math.min(index === 0 ? FIRST_ATTEMPT_TIMEOUT_MS : LATER_ATTEMPT_TIMEOUT_MS, remaining);
    try {
      const response = await client.models.generateContent({
        model,
        contents: options.contents as ContentListUnion,
        config: { ...baseConfig, abortSignal: AbortSignal.timeout(timeoutMs) },
      });
      return { text: response.text, modelUsed: model, response };
    } catch (err) {
      if (isApiKeyError(err)) throw keyRejected();
      lastError = err;
      if (!shouldTryNextModel(err)) throw err;
      const cooldown = modelCooldownMs(err);
      if (cooldown > 0) modelCooldowns.set(`${keyId}:${model}`, Date.now() + cooldown);
      const failure = err as { status?: number; name?: string };
      const next = models[index + 1];
      console.warn(
        `[Gemini] ${model} failed for ${options.task} (status: ${failure?.status || failure?.name || "error"})` +
          (next ? `; trying ${next}.` : "; no models left.")
      );
    }
  }
  throw lastError;
}

/**
 * Translates raw AI/Gemini errors and error codes into clean, user-friendly messages.
 * Prevents raw JSON objects (e.g. {"error": {"code": 429...}}) from leaking to the UI.
 */
export function formatAiErrorMessage(error: unknown): string {
  if (!error) return "Failed to communicate with AI service";
  if (error instanceof AiUserError) return error.message;

  const err = error as {
    status?: number | string;
    code?: number | string;
    statusCode?: number | string;
    message?: string;
    error?: { code?: number | string; status?: number | string };
  };
  let code: number | string | undefined =
    err?.status || err?.code || err?.statusCode || err?.error?.code || err?.error?.status;
  let rawMessage: string = err?.message || String(error);

  // Check if rawMessage contains a JSON string
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        code = parsed.error.code || parsed.error.status || code;
        if (parsed.error.message && !code) {
          rawMessage = parsed.error.message;
        }
      }
    }
  } catch {
    // ignore JSON parsing issues
  }

  const strCode = String(code || "").toUpperCase();
  const lowerMsg = rawMessage.toLowerCase();

  if (
    strCode === "429" ||
    strCode.includes("RESOURCE_EXHAUSTED") ||
    lowerMsg.includes("429") ||
    lowerMsg.includes("quota") ||
    lowerMsg.includes("resource_exhausted") ||
    lowerMsg.includes("rate limit")
  ) {
    return "AI request limit reached. Please wait a moment and try again, or add a custom Gemini API key in Settings.";
  }

  if (
    strCode === "403" ||
    strCode.includes("PERMISSION_DENIED") ||
    lowerMsg.includes("403") ||
    lowerMsg.includes("api key not valid") ||
    lowerMsg.includes("permission_denied") ||
    lowerMsg.includes("invalid api key")
  ) {
    return "Invalid or unauthorized API key. Please check your Gemini API key in Settings.";
  }

  if (
    strCode === "503" ||
    strCode.includes("UNAVAILABLE") ||
    lowerMsg.includes("503") ||
    lowerMsg.includes("unavailable") ||
    lowerMsg.includes("high demand") ||
    lowerMsg.includes("overloaded")
  ) {
    return "AI service is temporarily experiencing high traffic. Please try again in a few moments.";
  }

  if (
    strCode === "400" ||
    strCode.includes("INVALID_ARGUMENT") ||
    lowerMsg.includes("safety") ||
    lowerMsg.includes("blocked")
  ) {
    return "The input could not be processed by AI. Please adjust the input or upload a clearer photo.";
  }

  if (
    strCode === "504" ||
    strCode === "408" ||
    strCode.includes("DEADLINE_EXCEEDED") ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("deadline_exceeded")
  ) {
    return "AI request timed out. Please try again.";
  }

  if (
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("enotfound") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("econnreset")
  ) {
    return "Network error communicating with AI service. Please check your internet connection.";
  }

  // Anything else (a database error, a bug, provider internals) is never shown
  // as it is: it can contain internal addresses or other details.
  return "AI service encountered an unexpected error. Please try again.";
}

export default genAI;
