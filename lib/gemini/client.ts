import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenAI({ apiKey });

/**
 * Primary Flash model for high-intelligence multi-domain coaching, meal analysis, and data analysis.
 */
export const flashModel = "gemini-3.7-flash";

/**
 * Ultra-fast lightweight model for rapid daily briefs and fast multi-log parsing.
 */
export const flashLiteModel = "gemini-flash-lite";

/**
 * Resolves user/command model choice to supported Gemini model ID. Defaults to flashLiteModel.
 */
export function resolveGeminiModel(choice?: string): string {
  if (!choice) return flashLiteModel;
  const lower = choice.toLowerCase().trim();
  if (lower.includes("3.6") || lower === "flash-3.6" || (lower.includes("flash") && !lower.includes("lite"))) {
    return flashModel;
  }
  return flashLiteModel;
}

export default genAI;
