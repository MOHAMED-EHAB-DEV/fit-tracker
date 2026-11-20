import { MacroSplit } from "./fitness";

export interface MealAnalysisItem extends MacroSplit {
  name: string;
  quantity: string;
  /** Re-analysis only: 1-based number of the current ingredient this item keeps. */
  fromCurrent?: number;
}

export interface MealAnalysisResponse {
  mealDescription: string;
  items: MealAnalysisItem[];
  totals: MacroSplit;
  confidence: "high" | "medium" | "low";
  confidenceReason?: string;
  geminiNotes?: string;
}

export interface BodyCompAnalysisResponse {
  qualitativeNotes: string;
  estimatedBodyFatPercent?: number;
  estimatedBodyFatRange: string;
  comparedToPrevious?: string;
  muscleGroupHighlights?: string[];
  recommendations?: string[];
}

export type GeminiModelChoice =
  | "gemini-3.7-flash"
  | "gemini-3.6-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-flash-lite";

export type AIPowerMode = "full" | "balanced" | "low";

export interface DataContextSummary {
  dataType: "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today";
  days: number;
  recordsCount: number;
  tokensEstimated: number;
  badgeLabel: string;
}

// Coach chat request/response types live in lib/assistant/types.ts.
