import type { MealData } from "@/lib/nutrition/types";
import type { MealType } from "@/types/fitness";

/** Minimal shape of a Meal document (lean or hydrated) needed for the DTO. */
export interface MealDocLike {
  _id: { toString(): string };
  description?: string;
  mealType: MealType;
  loggedAt?: Date | string;
  dateString?: string;
  imageSource?: "photo" | "text_only";
  isManualOverride?: boolean;
  notes?: string;
  items?: Array<{
    name?: string;
    quantity?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  }> | null;
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number } | null;
  aiMacros?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    confidence?: "high" | "medium" | "low";
    confidenceReason?: string;
    geminiNotes?: string;
    modelUsed?: string;
  } | null;
  images?: Array<{ secureUrl?: string; width?: number; height?: number }> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const iso = (value: Date | string | undefined): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Plain, serialisable meal for client components (no storage ids). */
export function toMealDTO(doc: MealDocLike): MealData {
  return {
    _id: doc._id.toString(),
    description: doc.description || "",
    mealType: doc.mealType,
    loggedAt: iso(doc.loggedAt),
    dateString: doc.dateString,
    imageSource: doc.imageSource === "photo" ? "photo" : "text_only",
    isManualOverride: Boolean(doc.isManualOverride),
    notes: doc.notes || "",
    items: Array.isArray(doc.items)
      ? doc.items.map((item) => ({
          name: item.name || "",
          quantity: item.quantity || "",
          calories: num(item.calories),
          protein: num(item.protein),
          carbs: num(item.carbs),
          fat: num(item.fat),
          fiber: num(item.fiber),
        }))
      : [],
    macros: {
      calories: num(doc.macros?.calories),
      protein: num(doc.macros?.protein),
      carbs: num(doc.macros?.carbs),
      fat: num(doc.macros?.fat),
      fiber: num(doc.macros?.fiber),
    },
    aiMacros: doc.aiMacros
      ? {
          calories: doc.aiMacros.calories,
          protein: doc.aiMacros.protein,
          carbs: doc.aiMacros.carbs,
          fat: doc.aiMacros.fat,
          fiber: doc.aiMacros.fiber,
          confidence: doc.aiMacros.confidence,
          confidenceReason: doc.aiMacros.confidenceReason || "",
          geminiNotes: doc.aiMacros.geminiNotes || "",
          modelUsed: doc.aiMacros.modelUsed || "",
        }
      : null,
    images: Array.isArray(doc.images)
      ? doc.images
          .filter((image) => typeof image?.secureUrl === "string" && image.secureUrl.startsWith("https://"))
          .map((image) => ({ secureUrl: image.secureUrl as string, width: image.width, height: image.height }))
      : [],
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/** Chronological order (earliest first) used by every meal list. */
export function sortMealsChronologically<T extends { loggedAt?: string | Date }>(meals: T[]): T[] {
  return [...meals].sort((a, b) => {
    const x = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
    const y = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
    return x - y;
  });
}
