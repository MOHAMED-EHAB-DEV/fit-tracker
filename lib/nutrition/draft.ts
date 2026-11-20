import { isValidDateString, localDateString, localParts } from "@/lib/time";
import { ITEM_BOUNDS, MEAL_LIMITS } from "@/lib/validation/nutrition";
import {
  MACRO_KEYS,
  defaultMealTypeForHour,
  defaultTimeForMealType,
  roundMacros,
  sumMacros,
  type MacroKey,
  type Macros,
} from "@/lib/nutrition/totals";
import { localTimeString, mealTimeForForm } from "@/lib/nutrition/meal-time";
import type { MealProposal } from "@/lib/nutrition/analysis";
import type { MealData, MealItem } from "@/lib/nutrition/types";
import type { MealType } from "@/types/fitness";

/**
 * Form state for adding, editing and reviewing a meal. Every number is kept as
 * the text the user typed; the payload is built (and validated) only on save.
 * With ingredients, the meal totals are always the sum of the ingredients.
 */

export interface DraftItem {
  key: string;
  name: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

export type DraftTotals = Record<MacroKey, string>;

export interface MealDraft {
  description: string;
  mealType: MealType;
  dateString: string;
  time: string;
  notes: string;
  items: DraftItem[];
  /** Used only while there are no ingredients. */
  totals: DraftTotals;
}

export interface MealPayload {
  description: string;
  mealType: MealType;
  dateString: string;
  time: string;
  notes: string;
  items: Array<Required<Omit<MealItem, "quantity">> & { quantity: string }>;
  macros: Macros;
}

export const TOTAL_BOUNDS: Record<MacroKey, number> = {
  calories: 20_000,
  protein: 2_000,
  carbs: 3_000,
  fat: 2_000,
  fiber: 500,
};

export const MACRO_LABELS: Record<MacroKey, string> = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fiber",
};

let keyCounter = 0;
export function newItemKey(): string {
  keyCounter += 1;
  return `item-${keyCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Number -> input text ("12.3", "0"). */
export function numberToField(value: number | undefined | null, decimals: number = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const factor = 10 ** decimals;
  return String(Math.round(n * factor) / factor);
}

export const emptyTotals = (): DraftTotals => ({ calories: "", protein: "", carbs: "", fat: "", fiber: "" });

export function macrosToDraftTotals(m: Partial<Macros>): DraftTotals {
  return {
    calories: numberToField(m.calories, 0),
    protein: numberToField(m.protein),
    carbs: numberToField(m.carbs),
    fat: numberToField(m.fat),
    fiber: numberToField(m.fiber ?? 0),
  };
}

export function itemToDraft(item: MealItem, key: string = newItemKey()): DraftItem {
  return {
    key,
    name: item.name || "",
    quantity: item.quantity || "",
    ...macrosToDraftTotals(item),
  };
}

export function blankItem(): DraftItem {
  return { key: newItemKey(), name: "", quantity: "", ...emptyTotals() };
}

type ParseResult = { ok: true; value: number } | { ok: false };

/** "" -> 0; rejects text, negatives and values above `max`. */
export function parseAmount(raw: string, max: number): ParseResult {
  const trimmed = (raw ?? "").trim().replace(",", ".");
  if (trimmed === "") return { ok: true, value: 0 };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > max) return { ok: false };
  return { ok: true, value };
}

/** Lenient reading for live totals (invalid text counts as 0). */
export function draftMacros(fields: Record<MacroKey, string>): Macros {
  const out = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const key of MACRO_KEYS) {
    const parsed = parseAmount(fields[key], Number.MAX_SAFE_INTEGER);
    out[key] = parsed.ok ? parsed.value : 0;
  }
  return roundMacros(out);
}

/** What the meal adds up to right now. */
export function draftTotals(draft: Pick<MealDraft, "items" | "totals">): Macros {
  return draft.items.length > 0 ? sumMacros(draft.items.map(draftMacros)) : draftMacros(draft.totals);
}

function hasTypedTotals(totals: DraftTotals): boolean {
  return MACRO_KEYS.some((key) => {
    const parsed = parseAmount(totals[key], Number.MAX_SAFE_INTEGER);
    return parsed.ok && parsed.value > 0;
  });
}

/**
 * Adds an ingredient. When the meal had no ingredients but the user had typed
 * totals, those totals are kept as their own line first so adding "cheese"
 * to a 600 kcal sandwich gives 600 + cheese, not just the cheese.
 */
export function addItemToDraft(draft: MealDraft, item: DraftItem = blankItem()): MealDraft {
  if (draft.items.length === 0 && hasTypedTotals(draft.totals)) {
    const carried: DraftItem = {
      key: newItemKey(),
      name: draft.description.trim().slice(0, MEAL_LIMITS.itemNameMax) || "Rest of meal",
      quantity: "",
      ...draft.totals,
    };
    return { ...draft, items: [carried, item] };
  }
  return { ...draft, items: [...draft.items, item] };
}

/** Removing the last ingredient turns the totals back into editable fields holding what was left. */
export function removeItemFromDraft(draft: MealDraft, key: string): MealDraft {
  const items = draft.items.filter((item) => item.key !== key);
  if (items.length === 0) {
    return { ...draft, items, totals: emptyTotals() };
  }
  return { ...draft, items };
}

export type DraftValidation = { ok: true; payload: MealPayload } | { ok: false; error: string };

/** Checks the draft and builds the request body. `today` is the user's local date. */
export function validateDraft(draft: MealDraft, today: string): DraftValidation {
  if (!isValidDateString(draft.dateString)) return { ok: false, error: "Pick the day you ate this meal." };
  if (draft.dateString > today) return { ok: false, error: "Meals can't be logged for a future day." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return { ok: false, error: "Enter the time you ate (HH:MM)." };

  const items: MealPayload["items"] = [];
  for (let index = 0; index < draft.items.length; index++) {
    const item = draft.items[index];
    const label = item.name.trim() || `Ingredient ${index + 1}`;
    if (!item.name.trim()) return { ok: false, error: `Ingredient ${index + 1} needs a name.` };
    if (item.name.trim().length > MEAL_LIMITS.itemNameMax) return { ok: false, error: `"${label}" has a name that is too long.` };
    if (item.quantity.trim().length > MEAL_LIMITS.quantityMax) return { ok: false, error: `The portion of "${label}" is too long.` };
    if (item.calories.trim() === "") return { ok: false, error: `Enter the calories for "${label}".` };
    const values: Partial<Macros> = {};
    for (const key of MACRO_KEYS) {
      const parsed = parseAmount(item[key], ITEM_BOUNDS[key]);
      if (!parsed.ok) {
        return { ok: false, error: `${MACRO_LABELS[key]} for "${label}" must be between 0 and ${ITEM_BOUNDS[key]}.` };
      }
      values[key] = parsed.value;
    }
    const rounded = roundMacros(values);
    items.push({ name: item.name.trim(), quantity: item.quantity.trim(), ...rounded });
  }
  if (items.length > MEAL_LIMITS.itemsMax) return { ok: false, error: `A meal can have at most ${MEAL_LIMITS.itemsMax} ingredients.` };

  let macros: Macros;
  if (items.length > 0) {
    macros = sumMacros(items);
  } else {
    if (draft.totals.calories.trim() === "") return { ok: false, error: "Enter the calories, or add ingredients." };
    const values: Partial<Macros> = {};
    for (const key of MACRO_KEYS) {
      const parsed = parseAmount(draft.totals[key], TOTAL_BOUNDS[key]);
      if (!parsed.ok) return { ok: false, error: `${MACRO_LABELS[key]} must be between 0 and ${TOTAL_BOUNDS[key]}.` };
      values[key] = parsed.value;
    }
    macros = roundMacros(values);
  }

  const description =
    draft.description.trim() || items.map((item) => item.name).join(", ").slice(0, MEAL_LIMITS.descriptionMax);
  if (!description) return { ok: false, error: "Describe the meal." };
  if (description.length > MEAL_LIMITS.descriptionMax) {
    return { ok: false, error: `Keep the description under ${MEAL_LIMITS.descriptionMax} characters.` };
  }
  if (draft.notes.trim().length > MEAL_LIMITS.notesMax) {
    return { ok: false, error: `Keep notes under ${MEAL_LIMITS.notesMax} characters.` };
  }

  return {
    ok: true,
    payload: {
      description,
      mealType: draft.mealType,
      dateString: draft.dateString,
      time: draft.time,
      notes: draft.notes.trim(),
      items,
      macros,
    },
  };
}

/** True when the draft differs from where it started (used to guard against losing edits). */
export function isDraftDirty(initial: MealDraft, current: MealDraft): boolean {
  const comparable = (draft: MealDraft) =>
    JSON.stringify({
      ...draft,
      items: draft.items.map((item) => [item.name, item.quantity, ...MACRO_KEYS.map((key) => item[key])]),
    });
  return comparable(initial) !== comparable(current);
}

/** A fresh draft for `dateString`, defaulting the meal type and time to the user's local clock. */
export function newMealDraft(dateString: string, tz: string | null | undefined, now: Date = new Date()): MealDraft {
  const today = localDateString(now, tz);
  const parts = localParts(now, tz);
  const mealType = defaultMealTypeForHour(parts.hour);
  return {
    description: "",
    mealType,
    dateString,
    time: dateString === today ? localTimeString(now, tz) : defaultTimeForMealType(mealType),
    notes: "",
    items: [],
    totals: emptyTotals(),
  };
}

/** Edit form state for a saved meal. */
export function draftFromMeal(meal: MealData, tz: string | null | undefined): MealDraft {
  const dateString = meal.dateString || localDateString(meal.loggedAt ? new Date(meal.loggedAt) : new Date(), tz);
  const items = (meal.items || []).map((item) => itemToDraft(item));
  return {
    description: meal.description || "",
    mealType: meal.mealType,
    dateString,
    time: mealTimeForForm(meal.loggedAt, dateString, meal.mealType, tz),
    notes: meal.notes || "",
    items,
    totals: items.length > 0 ? emptyTotals() : macrosToDraftTotals(meal.macros),
  };
}

/** Puts an AI proposal into a draft, keeping the user's day, time, type and notes. */
export function applyProposalToDraft(base: MealDraft, proposal: MealProposal): MealDraft {
  const items = proposal.items.map((item) => itemToDraft(item));
  return {
    ...base,
    description: proposal.mealDescription || base.description,
    items,
    totals: items.length > 0 ? emptyTotals() : macrosToDraftTotals(proposal.totals),
  };
}

/** The draft's ingredients in the shape the analyzer expects (unparseable numbers count as 0). */
export function draftItemsForPrompt(draft: MealDraft): MealPayload["items"] {
  return draft.items
    .filter((item) => item.name.trim())
    .slice(0, MEAL_LIMITS.itemsMax)
    .map((item) => {
      const m = draftMacros(item);
      const clamp = (key: MacroKey) => Math.min(m[key], ITEM_BOUNDS[key]);
      return {
        name: item.name.trim().slice(0, MEAL_LIMITS.itemNameMax),
        quantity: item.quantity.trim().slice(0, MEAL_LIMITS.quantityMax),
        calories: clamp("calories"),
        protein: clamp("protein"),
        carbs: clamp("carbs"),
        fat: clamp("fat"),
        fiber: clamp("fiber"),
      };
    });
}
