import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import AssistantCommit from "@/lib/assistant/commit-model";
import { recomputeDay } from "@/lib/fitness/daily-log";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { toKg } from "@/lib/fitness/units";
import { zonedTimeToUtc } from "@/lib/time";
import { updateUserProfile } from "@/lib/users/profile";
import { badRequest, conflict } from "@/lib/api/errors";
import { describeProposal, resolveLogDate } from "@/lib/assistant/proposals";
import { LOG_LIMITS, type CommitRequest } from "@/lib/validation/assistant";
import type { CommitResponseBody } from "@/lib/assistant/types";

/**
 * Writes one log the user confirmed in the coach. Idempotent per commit id:
 * the commit row reserves the id of the document it creates, so a retried
 * request (lost response, double tap) finds that document instead of
 * creating another.
 */

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

function dayAnchor(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/** When the entry happened: now for today, local noon for an earlier day. */
function loggedAtFor(dateString: string, today: string, timeZone: string): Date {
  return dateString === today ? new Date() : zonedTimeToUtc(dateString, "12:00", timeZone);
}

async function upsertWithRetry(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    await run();
  }
}

async function claim(userId: string, commitId: string, kind: CommitRequest["proposal"]["kind"]) {
  const find = () =>
    AssistantCommit.findOneAndUpdate(
      { userId, commitId },
      { $setOnInsert: { kind, targetId: new mongoose.Types.ObjectId(), status: "pending" } },
      { upsert: true, returnDocument: "after" }
    ).lean();
  try {
    return await find();
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    return await find();
  }
}

export async function commitProposal(
  userId: string,
  timeZone: string,
  input: CommitRequest
): Promise<CommitResponseBody> {
  await getDb();
  const proposal = input.proposal;
  const today = getTodayDateString(new Date(), timeZone);

  if (resolveLogDate(proposal.date, today) !== proposal.date) {
    throw badRequest(`Pick a date between ${LOG_LIMITS.maxPastDays} days ago and today.`);
  }
  if (proposal.kind === "weight") {
    const kg = toKg(proposal.weight, proposal.unit);
    if (kg < LOG_LIMITS.weightKgMin || kg > LOG_LIMITS.weightKgMax) {
      throw badRequest("That body weight is outside the supported range.");
    }
  }

  const commit = await claim(userId, input.commitId, proposal.kind);
  if (!commit) throw new Error("Could not reserve the commit id");
  if (commit.kind !== proposal.kind) throw conflict("This confirmation was already used for a different entry.");
  const summary = describeProposal(proposal);
  if (commit.status === "done") return { alreadyApplied: true, summary };

  const targetId = commit.targetId;
  const date = proposal.date;

  switch (proposal.kind) {
    case "meal": {
      try {
        await Meal.create({
          _id: targetId,
          userId,
          loggedAt: loggedAtFor(date, today, timeZone),
          dateString: date,
          mealType: proposal.mealType,
          description: proposal.description,
          imageSource: "text_only",
          images: [],
          aiMacros: null,
          items: [],
          macros: {
            calories: Math.round(proposal.calories),
            protein: proposal.protein,
            carbs: proposal.carbs,
            fat: proposal.fat,
            fiber: proposal.fiber,
          },
          isManualOverride: false,
        });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      await recomputeDay(userId, date);
      break;
    }

    case "water": {
      const amount = Math.round(proposal.amountMl);
      const run = () =>
        DailyLog.updateOne(
          { userId, dateString: date, "waterEntries._id": { $ne: targetId } },
          {
            $inc: { waterMl: amount },
            $push: { waterEntries: { _id: targetId, amount, loggedAt: loggedAtFor(date, today, timeZone) } },
            $setOnInsert: { date: dayAnchor(date) },
          },
          { upsert: true }
        );
      try {
        await upsertWithRetry(run);
      } catch (err) {
        // The day exists and already holds this entry: it was applied before.
        if (!isDuplicateKey(err)) throw err;
      }
      break;
    }

    case "steps": {
      await upsertWithRetry(() =>
        DailyLog.updateOne(
          { userId, dateString: date },
          {
            $set: { steps: Math.round(proposal.count), stepsSource: "manual", stepsSyncedAt: new Date() },
            $setOnInsert: { date: dayAnchor(date) },
          },
          { upsert: true }
        )
      );
      await recomputeDay(userId, date);
      break;
    }

    case "weight": {
      const weightKg = toKg(proposal.weight, proposal.unit);
      try {
        await BodyComp.create({
          _id: targetId,
          userId,
          checkInDate: loggedAtFor(date, today, timeZone),
          dateString: date,
          weight: weightKg,
          photos: [],
          notes: "Logged from the AI Coach",
        });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      // Only the most recent weigh-in becomes the profile weight.
      const newer = await BodyComp.exists({
        userId,
        _id: { $ne: targetId },
        dateString: { $gt: date },
        weight: { $ne: null },
      });
      if (!newer) await updateUserProfile(userId, { fitnessProfile: { weightKg } });
      break;
    }
  }

  await AssistantCommit.updateOne({ _id: commit._id }, { $set: { status: "done" } });
  return { alreadyApplied: false, summary };
}
