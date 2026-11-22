"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import { getDayAnchorDate, getTodayDateString } from "@/lib/fitness/timezone";
import { addDays } from "@/lib/time";
import { publicErrorMessage } from "@/lib/api/route";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { deleteMealForUser } from "@/lib/nutrition/meals";

const MAX_WATER_STEP_ML = 5_000;
const MAX_WATER_DAY_ML = 20_000;

/**
 * Adds water to today's log (a negative amount undoes a mistaken tap).
 * "Today" is the user's own calendar day. An undo names the day its tap was
 * added to (today or yesterday), so an undo pressed after midnight takes the
 * water off the right day.
 */
export async function logWaterAction(
  amountMl: number,
  undoDateString?: string
): Promise<{ success: boolean; waterMl?: number; dateString?: string; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session) return { success: false, error: "Your session has expired. Please sign in again." };

    const amount = Math.round(Number(amountMl));
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_WATER_STEP_ML) {
      return { success: false, error: "Enter a water amount between 1 and 5000 ml" };
    }
    await enforceRateLimit(RATE_LIMITS.writePerMinute, session.userId);

    await getDb();
    const now = new Date();
    const today = getTodayDateString(now, session.timezone);
    let dateString = today;
    if (amount < 0 && typeof undoDateString === "string" && undoDateString !== today) {
      if (undoDateString !== addDays(today, -1)) {
        return { success: false, error: "That water entry is too old to undo." };
      }
      dateString = undoDateString;
    }
    const filter = { userId: session.userId, dateString };

    if (amount > 0) {
      const current = await DailyLog.findOne(filter).select("waterMl").lean();
      if ((current?.waterMl || 0) + amount > MAX_WATER_DAY_ML) {
        return { success: false, error: "That would be more than 20 litres today. Check the amount." };
      }
    }

    let updated: { waterMl?: number | null } | null;
    if (amount > 0) {
      updated = await DailyLog.findOneAndUpdate(
        filter,
        {
          $inc: { waterMl: amount },
          $push: { waterEntries: { amount, loggedAt: now } },
          $setOnInsert: { date: getDayAnchorDate(now, session.timezone) },
        },
        { upsert: true, returnDocument: "after" }
      ).lean();
    } else {
      // Never below zero, in one update (a separate clamp could erase a tap made in between).
      updated = await DailyLog.findOneAndUpdate(
        { ...filter, waterMl: { $gte: -amount } },
        { $inc: { waterMl: amount }, $push: { waterEntries: { amount, loggedAt: now } } },
        { returnDocument: "after" }
      ).lean();
      if (!updated) {
        updated = await DailyLog.findOneAndUpdate(
          { ...filter, waterMl: { $lt: -amount } },
          { $set: { waterMl: 0 }, $push: { waterEntries: { amount, loggedAt: now } } },
          { returnDocument: "after" }
        ).lean();
      }
    }

    const waterMl = Math.max(0, updated?.waterMl ?? 0);
    revalidatePath("/dashboard");
    return { success: true, waterMl, dateString };
  } catch (err) {
    console.error("logWaterAction:", err);
    return { success: false, error: publicErrorMessage(err) };
  }
}

/** Deletes one of the user's meals and its photos, then rebuilds that day's totals. */
export async function deleteMealAction(mealId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session) return { success: false, error: "Your session has expired. Please sign in again." };
    if (typeof mealId !== "string" || !/^[a-f\d]{24}$/i.test(mealId)) {
      return { success: false, error: "Meal not found" };
    }
    await enforceRateLimit(RATE_LIMITS.writePerMinute, session.userId);

    await deleteMealForUser(session.userId, mealId);

    revalidatePath("/dashboard");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err) {
    console.error("deleteMealAction:", err);
    return { success: false, error: publicErrorMessage(err) };
  }
}
