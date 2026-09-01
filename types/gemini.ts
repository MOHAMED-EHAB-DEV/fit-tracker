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
  confidenceReason?: string;
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

export interface ReferencedMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp?: string;
  commandName?: string;
}

export interface CoachAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

export interface CoachChatRequest {
  message: string;
  model?: GeminiModelChoice;
  mode?: "coach" | "log" | "auto";
  referencedMessages?: ReferencedMessage[];
  attachments?: CoachAttachment[];
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

