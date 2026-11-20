import { addDays, isValidDateString } from "@/lib/time";
import { roundTo, toKg, type WeightUnit } from "@/lib/fitness/units";
import { LOG_LIMITS } from "@/lib/validation/assistant";
import { MEAL_TYPES, type LogProposal, type MealTypeId } from "@/lib/assistant/types";

/**
 * Turns what the model extracted from a chat message into log proposals the
 * user must confirm. Nothing is invented: a missing value drops the item,
 * zero stays zero, negatives are rejected and large values are capped.
 */

export const MAX_PROPOSALS = 10;

export interface NormalizeContext {
  /** The user's local date ("YYYY-MM-DD"). */
  today: string;
  /** The user's preferred unit, used when the message did not name one. */
  weightUnit: WeightUnit;
  /** Meal type to use when the user did not say one (from their local time). */
  fallbackMealType: MealTypeId;
  makeId: () => string;
}

/** A model item, as loosely typed as the model may return it. */
export interface RawLogItem {
  type?: unknown;
  description?: unknown;
  mealType?: unknown;
  date?: unknown;
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  fiber?: unknown;
  amountMl?: unknown;
  steps?: unknown;
  weight?: unknown;
  weightUnit?: unknown;
}

const QUESTION_START =
  /^(should|can|could|would|will|is|are|am|do|does|did|how|what|which|why|when|where|who|whats|what's|is it|tell me|explain|any tips)\b/i;

/** True when the message reads as a question rather than a report of something done. */
export function looksLikeQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return true;
  if (/\?\s*$/.test(text)) return true;
  return QUESTION_START.test(text);
}

/** A reasonable meal type for a local hour (0-23); the user can change it before logging. */
export function inferMealType(hour: number): MealTypeId {
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

/** A non-negative number capped at `max`, or null when missing/negative. */
function amount(value: unknown, max: number, decimals: number): number | null {
  const number = finiteNumber(value);
  if (number === null || number < 0) return null;
  return roundTo(Math.min(number, max), decimals);
}

/** Resolves the date the user meant; null when it is in the future or too old. */
export function resolveLogDate(value: unknown, today: string): string | null {
  if (value === undefined || value === null || value === "" || value === "today") return today;
  if (value === "yesterday") return addDays(today, -1);
  if (typeof value !== "string" || !isValidDateString(value)) return null;
  if (value > today) return null;
  if (value < addDays(today, -LOG_LIMITS.maxPastDays)) return null;
  return value;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeProposals(raw: unknown, context: NormalizeContext): LogProposal[] {
  if (!Array.isArray(raw)) return [];
  const proposals: LogProposal[] = [];

  for (const item of raw as RawLogItem[]) {
    if (proposals.length >= MAX_PROPOSALS) break;
    if (!item || typeof item !== "object") continue;
    const date = resolveLogDate(item.date, context.today);
    if (!date) continue;

    switch (item.type) {
      case "meal": {
        const description = text(item.description, 200);
        const calories = amount(item.calories, LOG_LIMITS.calories, 0);
        const protein = amount(item.protein, LOG_LIMITS.protein, 1);
        const carbs = amount(item.carbs, LOG_LIMITS.carbs, 1);
        const fat = amount(item.fat, LOG_LIMITS.fat, 1);
        if (!description || calories === null || protein === null || carbs === null || fat === null) continue;
        const fiberValue = item.fiber === undefined || item.fiber === null ? 0 : amount(item.fiber, LOG_LIMITS.fiber, 1);
        if (fiberValue === null) continue;
        const mealType = (MEAL_TYPES as readonly string[]).includes(String(item.mealType))
          ? (item.mealType as MealTypeId)
          : context.fallbackMealType;
        proposals.push({
          kind: "meal",
          id: context.makeId(),
          date,
          description,
          mealType,
          calories,
          protein,
          carbs,
          fat,
          fiber: fiberValue,
        });
        break;
      }
      case "water": {
        const ml = amount(item.amountMl, LOG_LIMITS.waterMl, 0);
        if (!ml) continue;
        proposals.push({ kind: "water", id: context.makeId(), date, amountMl: ml });
        break;
      }
      case "steps": {
        const count = amount(item.steps, LOG_LIMITS.steps, 0);
        if (!count) continue;
        proposals.push({ kind: "steps", id: context.makeId(), date, count });
        break;
      }
      case "weight": {
        const value = finiteNumber(item.weight);
        if (value === null || value <= 0) continue;
        const unit: WeightUnit =
          item.weightUnit === "kg" || item.weightUnit === "lbs" ? item.weightUnit : context.weightUnit;
        const kg = toKg(value, unit);
        if (kg < LOG_LIMITS.weightKgMin || kg > LOG_LIMITS.weightKgMax) continue;
        proposals.push({ kind: "weight", id: context.makeId(), date, weight: roundTo(value, 1), unit });
        break;
      }
      default:
        break;
    }
  }

  return proposals;
}

/** One-line description of a proposal, for confirmations. */
export function describeProposal(proposal: LogProposal): string {
  switch (proposal.kind) {
    case "meal":
      return `${proposal.description} (${Math.round(proposal.calories)} kcal, ${proposal.protein} g protein)`;
    case "water":
      return `${proposal.amountMl} ml water`;
    case "steps":
      return `${proposal.count.toLocaleString("en-US")} steps`;
    case "weight":
      return `Weight ${proposal.weight} ${proposal.unit}`;
  }
}
