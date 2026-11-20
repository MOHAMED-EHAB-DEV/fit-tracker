import { z } from "zod";
import {
  boundedNumber,
  dateString,
  macros,
  mealType,
  objectId,
  timeString,
  trimmedText,
} from "@/lib/validation/common";

/** Limits shared by the meal routes, the analyzer and the client forms. */
export const MEAL_LIMITS = {
  descriptionMax: 300,
  aiDescriptionMax: 1000,
  notesMax: 500,
  itemNameMax: 120,
  quantityMax: 60,
  itemsMax: 40,
  photosMax: 4,
  /** Per photo, after client-side resizing (the client sends ~150-300 KB). */
  photoBytesMax: 3 * 1024 * 1024,
  /** Whole multipart body; stays under the hosting platform's 4.5 MB request cap. */
  requestBytesMax: Math.floor(4.4 * 1024 * 1024),
  proposalTokenMax: 8_000,
} as const;

/** Bounds for one ingredient. */
export const ITEM_BOUNDS = {
  calories: 10_000,
  protein: 1_000,
  carbs: 1_500,
  fat: 1_000,
  fiber: 300,
} as const;

export const mealItemSchema = z.object({
  name: trimmedText(MEAL_LIMITS.itemNameMax, 1),
  quantity: trimmedText(MEAL_LIMITS.quantityMax).optional().default(""),
  calories: boundedNumber(0, ITEM_BOUNDS.calories),
  protein: boundedNumber(0, ITEM_BOUNDS.protein),
  carbs: boundedNumber(0, ITEM_BOUNDS.carbs),
  fat: boundedNumber(0, ITEM_BOUNDS.fat),
  fiber: boundedNumber(0, ITEM_BOUNDS.fiber).optional().default(0),
});

const mealFields = {
  description: trimmedText(MEAL_LIMITS.descriptionMax, 1),
  mealType,
  dateString,
  /** Local wall-clock time ("HH:MM") in the user's zone. */
  time: timeString.optional(),
  notes: trimmedText(MEAL_LIMITS.notesMax).optional(),
  items: z.array(mealItemSchema).max(MEAL_LIMITS.itemsMax),
  /** Required when there are no items; ignored otherwise (totals = sum of items). */
  macros,
  /** Signed token from /api/meals/analyze carrying the AI's original estimate. */
  aiProposal: z.string().max(MEAL_LIMITS.proposalTokenMax),
};

export const mealCreateSchema = z
  .object({
    description: mealFields.description,
    mealType: mealFields.mealType,
    dateString: mealFields.dateString,
    time: mealFields.time,
    notes: mealFields.notes.default(""),
    items: mealFields.items.optional().default([]),
    macros: mealFields.macros.optional(),
    aiProposal: mealFields.aiProposal.optional(),
  })
  .strict()
  .refine((value) => value.items.length > 0 || value.macros !== undefined, {
    message: "Enter the meal's calories or add at least one ingredient",
    path: ["macros"],
  });

export const mealUpdateSchema = z
  .object({
    description: mealFields.description.optional(),
    mealType: mealFields.mealType.optional(),
    dateString: mealFields.dateString.optional(),
    time: mealFields.time,
    notes: mealFields.notes,
    items: mealFields.items.optional(),
    macros: mealFields.macros.optional(),
    aiProposal: mealFields.aiProposal.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Nothing to update",
  });

export const mealsQuerySchema = z.object({ date: dateString.optional() });

/** "Regenerate with AI" for a saved meal: the server loads the meal's own photos. */
export const mealRegenerateSchema = z
  .object({
    mealId: objectId,
    description: trimmedText(MEAL_LIMITS.aiDescriptionMax).optional().default(""),
    mealType: mealType.optional(),
    currentItems: z.array(mealItemSchema).max(MEAL_LIMITS.itemsMax).optional().default([]),
  })
  .strict();

/** Text fields of a multipart analysis request. */
export const mealAnalyzeFieldsSchema = z.object({
  description: trimmedText(MEAL_LIMITS.aiDescriptionMax).optional().default(""),
  mealType: mealType.optional(),
  dateString: dateString.optional(),
});

export type MealItemInput = z.infer<typeof mealItemSchema>;
export type MealCreateInput = z.infer<typeof mealCreateSchema>;
export type MealUpdateInput = z.infer<typeof mealUpdateSchema>;
export type MealRegenerateInput = z.infer<typeof mealRegenerateSchema>;
