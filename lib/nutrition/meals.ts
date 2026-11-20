import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import Meal, { type IMealImage } from "@/lib/db/models/Meal";
import { badRequest, notFound } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import { recomputeDays } from "@/lib/fitness/daily-log";
import { localDateString } from "@/lib/time";
import type { MealCreateInput, MealItemInput, MealUpdateInput } from "@/lib/validation/nutrition";
import { macrosDiffer, roundMacros, sumMacros, type Macros } from "@/lib/nutrition/totals";
import { EARLIEST_LOG_DATE, mealTimeForForm, resolveLoggedAt } from "@/lib/nutrition/meal-time";
import { proposalSecret, verifyProposalToken, type AiEstimate } from "@/lib/nutrition/proposal-token";
import { destroyMealImages, uploadMealPhotos } from "@/lib/nutrition/images";
import { sortMealsChronologically, toMealDTO, type MealDocLike } from "@/lib/nutrition/dto";
import type { MealData } from "@/lib/nutrition/types";

/**
 * Meal writes. Every create/edit/move/delete rebuilds the affected days'
 * totals from the meals themselves (recomputeDay), so the day cards can never
 * drift away from the meals listed under them.
 */

function assertNotFuture(dateString: string, timezone: string): void {
  if (dateString > localDateString(new Date(), timezone)) {
    throw badRequest("Meals can't be logged for a future day.");
  }
  if (dateString < EARLIEST_LOG_DATE) throw badRequest("Pick a more recent day.");
}

function normalizeItems(items: MealItemInput[]) {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity || "",
    ...roundMacros(item),
  }));
}

function readAiEstimate(token: string | undefined, userId: string): AiEstimate | null {
  if (!token) return null;
  return verifyProposalToken(token, userId, proposalSecret());
}

async function refreshTotals(userId: string, dates: string[]): Promise<void> {
  try {
    await recomputeDays(userId, dates);
  } catch (err) {
    // The meal itself is saved; the day summary is rebuilt on the next write.
    console.error("[meals] recomputeDay failed:", err);
  }
}

const asDTO = (doc: unknown): MealData => toMealDTO(doc as MealDocLike);

export async function listMealsForDay(userId: string, dateString: string): Promise<MealData[]> {
  await getDb();
  const meals = await Meal.find({ userId, dateString }).sort({ loggedAt: 1 }).lean();
  return sortMealsChronologically(meals.map(asDTO));
}

export async function getMealForUser(userId: string, mealId: string): Promise<MealData> {
  await getDb();
  const meal = await Meal.findOne({ _id: mealId, userId }).lean();
  if (!meal) throw notFound("Meal not found");
  return asDTO(meal);
}

/** Creates a meal; photos (already validated) are uploaded only now, at save time. */
export async function createMealForUser(
  session: SessionUser,
  input: MealCreateInput,
  photos: Buffer[] = []
): Promise<MealData> {
  assertNotFuture(input.dateString, session.timezone);
  await getDb();

  const items = normalizeItems(input.items);
  const macros: Macros = items.length > 0 ? sumMacros(items) : roundMacros(input.macros || {});
  const ai = readAiEstimate(input.aiProposal, session.userId);

  const images: IMealImage[] = photos.length > 0 ? await uploadMealPhotos(session.userId, photos) : [];

  let created;
  try {
    created = await Meal.create({
      userId: new mongoose.Types.ObjectId(session.userId),
      loggedAt: resolveLoggedAt(input.dateString, input.time, input.mealType, session.timezone),
      dateString: input.dateString,
      mealType: input.mealType,
      description: input.description,
      notes: input.notes || "",
      imageSource: images.length > 0 ? "photo" : "text_only",
      images,
      items,
      macros,
      aiMacros: ai,
      isManualOverride: ai ? macrosDiffer(macros, ai) : false,
    });
  } catch (err) {
    await destroyMealImages(session.userId, images);
    throw err;
  }

  await refreshTotals(session.userId, [input.dateString]);
  return asDTO(created.toObject());
}

export async function updateMealForUser(
  session: SessionUser,
  mealId: string,
  input: MealUpdateInput
): Promise<MealData> {
  await getDb();
  const existing = await Meal.findOne({ _id: mealId, userId: session.userId }).lean();
  if (!existing) throw notFound("Meal not found");

  const set: Record<string, unknown> = {};
  const oldDate = existing.dateString;
  const newDate = input.dateString ?? oldDate;
  const mealType = input.mealType ?? existing.mealType;
  if (input.dateString !== undefined) assertNotFuture(input.dateString, session.timezone);

  if (input.description !== undefined) set.description = input.description;
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.mealType !== undefined) set.mealType = input.mealType;

  if (input.dateString !== undefined || input.time !== undefined) {
    const time = input.time ?? mealTimeForForm(existing.loggedAt, oldDate, existing.mealType, session.timezone);
    set.dateString = newDate;
    set.loggedAt = resolveLoggedAt(newDate, time, mealType, session.timezone);
  }

  let macros: Macros = roundMacros(existing.macros || {});
  if (input.items !== undefined) {
    const items = normalizeItems(input.items);
    set.items = items;
    if (items.length > 0) macros = sumMacros(items);
    else if (input.macros) macros = roundMacros(input.macros);
  } else if (input.macros && !(existing.items && existing.items.length > 0)) {
    // With ingredients the totals always come from them, as when creating a meal.
    macros = roundMacros(input.macros);
  }
  set.macros = macros;

  let ai: AiEstimate | null = (existing.aiMacros as AiEstimate | null) || null;
  if (input.aiProposal !== undefined) {
    const fresh = readAiEstimate(input.aiProposal, session.userId);
    if (!fresh) throw badRequest("This AI result has expired. Run \"Regenerate with AI\" again, or save without it.");
    ai = fresh;
    set.aiMacros = fresh;
  }
  set.isManualOverride = ai ? macrosDiffer(macros, ai) : false;

  // The day the meal is on at the moment of the write (another request may
  // have moved it since it was read above): both days are rebuilt.
  const before = await Meal.findOneAndUpdate(
    { _id: mealId, userId: session.userId },
    { $set: set },
    { returnDocument: "before", runValidators: true }
  )
    .select("dateString")
    .lean();
  if (!before) throw notFound("Meal not found");
  const updated = await Meal.findOne({ _id: mealId, userId: session.userId }).lean();
  if (!updated) throw notFound("Meal not found");

  await refreshTotals(session.userId, [oldDate, before.dateString, newDate]);
  return asDTO(updated);
}

/** Deletes the meal, its photos, and rebuilds that day's totals. */
export async function deleteMealForUser(userId: string, mealId: string): Promise<{ dateString: string }> {
  await getDb();
  const deleted = await Meal.findOneAndDelete({ _id: mealId, userId }).lean();
  if (!deleted) throw notFound("Meal not found");

  await refreshTotals(userId, [deleted.dateString]);
  await destroyMealImages(userId, deleted.images, String(deleted._id));
  return { dateString: deleted.dateString };
}
