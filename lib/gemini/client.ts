import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenAI({ apiKey });

/**
 * Primary Flash model for high-intelligence multi-domain coaching, meal analysis, and data analysis.
 */
export const flashModel = "gemini-3.7-flash";

/**
 * Fallback Flash model if 3.7 experiences high demand (503), quota limits, or execution failure.
 */
export const fallbackFlashModel = "gemini-3.6-flash";

/**
 * Ultra-fast lightweight model for rapid daily briefs and fast multi-log parsing.
 */
export const flashLiteModel = "gemini-2.5-flash-lite";

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
    return undefined; // No limit
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
  responseSchema?: any;
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

  const config: Record<string, any> = {};

  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (responseSchema) config.responseSchema = responseSchema;
  if (typeof temperature === "number") config.temperature = temperature;
  if (typeof resolvedTokens === "number") config.maxOutputTokens = resolvedTokens;

  return config;
}

/**
 * Resolves user/command model choice to supported Gemini model ID.
 */
export function resolveGeminiModel(choice?: string): string {
  if (!choice) return AI_POWER_MODE === "full" ? flashModel : flashLiteModel;
  const lower = choice.toLowerCase().trim();
  if (
    lower.includes("3.7") ||
    lower.includes("3.6") ||
    lower === "flash-3.6" ||
    (lower.includes("flash") && !lower.includes("lite"))
  ) {
    return flashModel;
  }
  return flashLiteModel;
}

/**
 * Executes generateContent with automatic failover/switch between models.
 * If the primary model fails (e.g. 503 high demand, rate limits, or error),
 * it seamlessly switches to the fallback model (gemini-3.6-flash).
 */
export async function generateContentWithFallback(options: {
  contents: any[];
  config?: any;
  primaryModel?: string;
  fallbackModel?: string;
  apiKey?: string;
}): Promise<{ text: string | undefined; modelUsed: string; response: any }> {
  const primary = options.primaryModel || flashModel;
  const fallback = options.fallbackModel || fallbackFlashModel;
  const client = options.apiKey?.trim() ? new GoogleGenAI({ apiKey: options.apiKey.trim() }) : genAI;

  try {
    const response = await client.models.generateContent({
      model: primary,
      contents: options.contents,
      config: options.config,
    });
    return {
      text: response.text,
      modelUsed: primary,
      response,
    };
  } catch (primaryErr: any) {
    console.warn(
      `[Gemini Auto-Switch] Primary model (${primary}) failed (status: ${primaryErr?.status || primaryErr?.statusCode || "error"}). Switching to fallback model (${fallback})...`,
      primaryErr?.message || primaryErr
    );

    try {
      const fallbackResponse = await client.models.generateContent({
        model: fallback,
        contents: options.contents,
        config: options.config,
      });

      return {
        text: fallbackResponse.text,
        modelUsed: fallback,
        response: fallbackResponse,
      };
    } catch (fallbackErr: any) {
      console.error(`[Gemini Auto-Switch] Fallback model (${fallback}) also failed:`, fallbackErr);
      throw fallbackErr;
    }
}

/**
 * Translates raw AI/Gemini errors and error codes into clean, user-friendly messages.
 * Prevents raw JSON objects (e.g. {"error": {"code": 429...}}) from leaking to the UI.
 */
export function formatAiErrorMessage(err: any): string {
  if (!err) return "Failed to communicate with AI service";

  let code: number | string | undefined =
    err?.status || err?.code || err?.statusCode || err?.error?.code || err?.error?.status;
  let rawMessage = err?.message || String(err);

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

  // Ensure raw JSON is never returned
  if (rawMessage.startsWith("{") || rawMessage.includes('{"error"')) {
    return "AI service encountered an unexpected error. Please try again.";
  }

  return rawMessage;
}

export default genAI;
