import type { MealType } from "@/types/fitness";

/** Client-safe shapes for meals (what the server sends to components). */

export interface MealItem {
  name: string;
  quantity?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface MealAiEstimate {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  confidence?: "high" | "medium" | "low";
  confidenceReason?: string;
  geminiNotes?: string;
  modelUsed?: string;
}

export interface MealImageView {
  secureUrl: string;
  width?: number;
  height?: number;
}

export interface MealData {
  _id: string;
  description: string;
  mealType: MealType;
  loggedAt?: string | Date;
  dateString?: string;
  imageSource?: "photo" | "text_only";
  isManualOverride?: boolean;
  notes?: string;
  items?: MealItem[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  aiMacros?: MealAiEstimate | null;
  images?: MealImageView[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

/** Proposal returned by POST /api/meals/analyze. */
export interface AnalyzeResponse {
  proposal: import("@/lib/nutrition/analysis").MealProposal;
  proposalToken: string;
  warnings: string[];
  photosAnalyzed: number;
  modelUsed: string;
}
