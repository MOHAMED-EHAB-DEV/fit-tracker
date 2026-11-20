import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import DailyLog from "@/lib/db/models/DailyLog";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { localDateString } from "@/lib/time";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { toHabitDTO, type HabitDocLike, type HabitDTO } from "@/lib/habits/dto";
import { completionForDay } from "@/lib/habits/completion";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_EMOJI } from "@/lib/habits/colors";
import type { CreateHabitInput, HabitLogInput, UpdateHabitInput } from "@/lib/validation/habits";

const HABIT_FIELDS = "name description emoji color order isActive archivedAt createdAt updatedAt";

function toObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) throw badRequest("Invalid id");
  return new mongoose.Types.ObjectId(id);
}

export interface HabitLists {
  active: HabitDTO[];
  archived: HabitDTO[];
}

export async function listHabits(userId: string, timeZone: string, includeArchived = false): Promise<HabitLists> {
  await getDb();
  const filter = includeArchived ? { userId } : { userId, isActive: true };
  const docs = (await Habit.find(filter)
    .select(HABIT_FIELDS)
    .sort({ order: 1, createdAt: 1 })
    .lean()) as unknown as HabitDocLike[];
  const all = docs.map((doc) => toHabitDTO(doc, timeZone));
  return {
    active: all.filter((h) => h.isActive),
    archived: all
      .filter((h) => !h.isActive)
      .sort((a, b) => (b.archivedDate || "").localeCompare(a.archivedDate || "")),
  };
}

export interface TodayHabitsData {
  todayDateString: string;
  /** Active habits, in display order. */
  habits: HabitDTO[];
  /** Archived habits (newest archive first); empty unless requested. */
  archived: HabitDTO[];
  /** Today's completed ids, restricted to habits active today. */
  completedHabitIds: string[];
}

/**
 * Everything the habits page and the dashboard habits widget need for today.
 * Completed ids that do not belong to an active habit are dropped.
 */
export async function getTodayHabitsData(
  userId: string,
  timeZone: string,
  options: { includeArchived?: boolean; now?: Date } = {}
): Promise<TodayHabitsData> {
  await getDb();
  const todayDateString = getTodayDateString(options.now ?? new Date(), timeZone);
  const [lists, todayLog] = await Promise.all([
    listHabits(userId, timeZone, options.includeArchived ?? false),
    DailyLog.findOne({ userId, dateString: todayDateString }).select("completedHabitIds").lean(),
  ]);
  const completed = completionForDay(
    lists.active,
    (todayLog?.completedHabitIds || []).map(String),
    todayDateString
  );
  return {
    todayDateString,
    habits: lists.active,
    archived: lists.archived,
    completedHabitIds: completed.completedIds,
  };
}

export async function createHabit(userId: string, timeZone: string, input: CreateHabitInput): Promise<HabitDTO> {
  await getDb();
  const last = await Habit.findOne({ userId, isActive: true }).sort({ order: -1 }).select("order").lean();
  const habit = await Habit.create({
    userId,
    name: input.name,
    description: input.description ?? "",
    emoji: input.emoji || DEFAULT_HABIT_EMOJI,
    color: input.color || DEFAULT_HABIT_COLOR,
    order: last ? (last.order || 0) + 1 : 0,
    isActive: true,
    archivedAt: null,
  });
  return toHabitDTO(habit.toObject() as unknown as HabitDocLike, timeZone);
}

export async function updateHabit(
  userId: string,
  timeZone: string,
  habitId: string,
  input: UpdateHabitInput
): Promise<HabitDTO> {
  await getDb();
  const _id = toObjectId(habitId);
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.emoji !== undefined) set.emoji = input.emoji;
  if (input.color !== undefined) set.color = input.color;
  if (input.order !== undefined) set.order = input.order;

  if (input.isActive === false) {
    set.isActive = false;
    set.archivedAt = new Date();
  } else if (input.isActive === true) {
    set.isActive = true;
    set.archivedAt = null;
    if (input.order === undefined) {
      const last = await Habit.findOne({ userId, isActive: true }).sort({ order: -1 }).select("order").lean();
      set.order = last ? (last.order || 0) + 1 : 0;
    }
  }

  // Archiving an already archived habit must keep its original archive date.
  const filter: Record<string, unknown> = { _id, userId };
  if (input.isActive === false) filter.isActive = true;

  const updated = await Habit.findOneAndUpdate(
    filter,
    { $set: set },
    { returnDocument: "after", runValidators: true, projection: HABIT_FIELDS }
  ).lean();

  if (!updated) {
    // Not found, or archiving a habit that is already archived (a no-op).
    const current = await Habit.findOne({ _id, userId }).select(HABIT_FIELDS).lean();
    if (!current) throw notFound("Habit not found");
    return toHabitDTO(current as unknown as HabitDocLike, timeZone);
  }
  return toHabitDTO(updated as unknown as HabitDocLike, timeZone);
}

export interface HabitLogResult {
  habitId: string;
  dateString: string;
  isCompleted: boolean;
}

/**
 * Checks or unchecks a habit for one day. Atomic ($addToSet / $pull), so
 * concurrent taps cannot lose each other's updates.
 */
export async function logHabit(userId: string, timeZone: string, input: HabitLogInput): Promise<HabitLogResult> {
  await getDb();
  const today = getTodayDateString(new Date(), timeZone);
  if (input.dateString > today) throw badRequest("You can't log a habit for a future day");

  const habitObjectId = toObjectId(input.habitId);
  const habit = await Habit.findOne({ _id: habitObjectId, userId }).select("isActive createdAt").lean();
  if (!habit) throw notFound("Habit not found");
  if (habit.isActive === false) throw conflict("This habit is archived. Restore it before logging it.");

  if (input.action === "check") {
    const createdAt = habit.createdAt ? new Date(habit.createdAt) : habitObjectId.getTimestamp();
    if (input.dateString < localDateString(createdAt, timeZone)) {
      throw badRequest("This habit didn't exist yet on that day");
    }
    const update = {
      $addToSet: { completedHabitIds: habitObjectId },
      // Same anchor as getDayAnchorDate: UTC midnight of the local calendar day.
      $setOnInsert: { date: new Date(`${input.dateString}T00:00:00.000Z`) },
    };
    const filter = { userId, dateString: input.dateString };
    try {
      await DailyLog.updateOne(filter, update, { upsert: true, setDefaultsOnInsert: true });
    } catch (err) {
      // Two first writes for the same day can race on the unique index; the retry updates.
      if ((err as { code?: number })?.code !== 11000) throw err;
      await DailyLog.updateOne(filter, update);
    }
    return { habitId: input.habitId, dateString: input.dateString, isCompleted: true };
  }

  await DailyLog.updateOne(
    { userId, dateString: input.dateString },
    { $pull: { completedHabitIds: habitObjectId } }
  );
  return { habitId: input.habitId, dateString: input.dateString, isCompleted: false };
}

export interface HabitLogDay {
  dateString: string;
  completedHabitIds: string[];
}

export async function listHabitLogs(userId: string, from: string, to: string): Promise<HabitLogDay[]> {
  await getDb();
  const logs = await DailyLog.find({ userId, dateString: { $gte: from, $lte: to } })
    .select("dateString completedHabitIds")
    .lean();
  return logs.map((log) => ({
    dateString: log.dateString,
    completedHabitIds: (log.completedHabitIds || []).map(String),
  }));
}
