import { MacroSplit } from "./fitness";

export interface MealAnalysisItem extends MacroSplit {
  name: string;
  quantity: string;
}

export interface MealAnalysisResponse {
  mealDescription: string;
  items: MealAnalysisItem[];
  totals: MacroSplit;
  confidence: "high" | "medium" | "low";
  geminiNotes?: string;
}

export interface MultiLogItem {
  type: "meal" | "water" | "steps" | "weight" | "note";
  description: string;
  macros?: MacroSplit;
  amountMl?: number;
  count?: number;
  weightKg?: number;
  confidence: "high" | "medium" | "low";
}

export interface MultiLogResponse {
  logItems: MultiLogItem[];
  chatReply: string;
  parseNotes?: string;
}

export interface BodyCompAnalysisResponse {
  qualitativeNotes: string;
  estimatedBodyFatRange: string;
  comparedToPrevious?: string;
  muscleGroupHighlights?: string[];
  recommendations?: string[];
}

export type GeminiModelChoice = "gemini-3.6-flash" | "gemini-flash-lite";

export interface DataContextSummary {
  dataType: "meals" | "workouts" | "bodycomp" | "progress" | "all" | "today";
  days: number;
  recordsCount: number;
  tokensEstimated: number;
  badgeLabel: string;
}

export interface CoachChatRequest {
  message: string;
  model?: GeminiModelChoice;
  mode?: "coach" | "log" | "auto";
}

export interface CoachChatResponse {
  success: boolean;
  chatReply: string;
  modelUsed?: string;
  commandDetected?: string | null;
  dataContext?: DataContextSummary | null;
  logItems?: MultiLogItem[];
  writeResults?: {
    mealsCreated: number;
    waterAdded: number;
    stepsUpdated: number;
  };
  error?: string;
}
