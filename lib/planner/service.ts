import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent, { type IPlannedEvent } from "@/lib/db/models/PlannedEvent";
import Habit from "@/lib/db/models/Habit";
import DailyLog from "@/lib/db/models/DailyLog";
import { badRequest, notFound } from "@/lib/api/errors";
import { addDays } from "@/lib/time";
import {
  candidateEventsFilter,
  completionAfterRecurrenceChange,
  isCompletedOn,
  isRecurring,
  occursOn,
  projectEventsForDate,
  type RecurrenceType,
} from "@/lib/planner/recurrence";
import { CATEGORY_COLORS, type PlannerCategory } from "@/lib/planner/ai-plan";
import { isEndAfterStart } from "@/lib/planner/time-sort";
import type { LinkedHabitDTO, PlannerEventDTO } from "@/lib/planner/types";
import type { PlannerBulkApply, PlannerEventCreate, PlannerEventPatch } from "@/lib/validation/planner";

/**
 * Planner reads and writes. Every query is scoped to the user, every write
 * is validated first, and completion changes are single atomic updates so
 * two quick taps cannot overwrite each other.
 */

type LeanEvent = Omit<IPlannedEvent, "linkedHabitIds" | keyof mongoose.Document> & {
  _id: mongoose.Types.ObjectId;
  linkedHabitIds: Array<mongoose.Types.ObjectId | (LinkedHabitDTO & { _id: mongoose.Types.ObjectId })>;
};

const HABIT_FIELDS = "name emoji color";

function habitPopulate(userId: string) {
  // `match` keeps a foreign habit id from ever exposing another user's habit.
  return { path: "linkedHabitIds", select: HABIT_FIELDS, match: { userId } };
}

function toHabitDTO(value: unknown): LinkedHabitDTO | null {
  if (!value || typeof value !== "object" || !("name" in value)) return null;
  const habit = value as { _id: unknown; name?: string; emoji?: string; color?: string };
  return {
    _id: String(habit._id),
    name: habit.name || "Habit",
    emoji: habit.emoji || "⚡",
    color: habit.color || "#10b981",
  };
}

export function toEventDTO(event: LeanEvent, dateString: string): PlannerEventDTO {
  const category = (event.category in CATEGORY_COLORS ? event.category : "other") as PlannerCategory;
  return {
    _id: String(event._id),
    date: event.date,
    occurrenceDate: dateString,
    title: event.title,
    description: event.description || "",
    startTime: event.startTime,
    endTime: event.endTime || "",
    category,
    color: /^#[0-9a-fA-F]{6}$/.test(event.color || "") ? event.color : CATEGORY_COLORS[category],
    recurrence: (event.recurrence || "once") as RecurrenceType,
    endDate: event.endDate ?? null,
    linkedHabitIds: (event.linkedHabitIds || []).map(toHabitDTO).filter((h): h is LinkedHabitDTO => h !== null),
    isCompleted: isCompletedOn(event, dateString),
  };
}

/** Every event on `dateString`, completion projected for that day, in planner order. */
export async function listEventsForDate(userId: string, dateString: string): Promise<PlannerEventDTO[]> {
  await getDb();
  const events = (await PlannedEvent.find(candidateEventsFilter(userId, dateString))
    .populate(habitPopulate(userId))
    .lean()) as unknown as LeanEvent[];
  return projectEventsForDate(events, dateString).map((event) => toEventDTO(event, dateString));
}

async function getOwnedEvent(userId: string, eventId: string): Promise<LeanEvent> {
  await getDb();
  const event = (await PlannedEvent.findOne({ _id: eventId, userId }).lean()) as unknown as LeanEvent | null;
  if (!event) throw notFound("Event not found");
  return event;
}

async function getEventDTO(userId: string, eventId: string, dateString: string): Promise<PlannerEventDTO> {
  const event = (await PlannedEvent.findOne({ _id: eventId, userId })
    .populate(habitPopulate(userId))
    .lean()) as unknown as LeanEvent | null;
  if (!event) throw notFound("Event not found");
  return toEventDTO(event, dateString);
}

/** Throws unless every id is one of the user's own habits. */
export async function assertOwnedHabits(userId: string, habitIds: string[]): Promise<void> {
  const unique = Array.from(new Set(habitIds));
  if (unique.length === 0) return;
  const count = await Habit.countDocuments({ _id: { $in: unique }, userId });
  if (count !== unique.length) throw badRequest("One of the linked habits was not found");
}

async function ownedHabitIdsAmong(userId: string, ids: unknown[]): Promise<mongoose.Types.ObjectId[]> {
  const unique = Array.from(new Set(ids.map(String)));
  if (unique.length === 0) return [];
  // Archived habits are not ticked (they no longer count towards the day).
  const owned = await Habit.find({ _id: { $in: unique }, userId, isActive: { $ne: false } })
    .select("_id")
    .lean();
  return owned.map((habit) => habit._id as mongoose.Types.ObjectId);
}

function dayAnchor(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

async function upsertDailyLog(
  userId: string,
  dateString: string,
  update: Record<string, unknown>
): Promise<{ completedHabitIds?: mongoose.Types.ObjectId[] } | null> {
  const run = () =>
    DailyLog.findOneAndUpdate(
      { userId, dateString },
      { ...update, $setOnInsert: { date: dayAnchor(dateString) } },
      { upsert: true, returnDocument: "before" }
    )
      .select("completedHabitIds")
      .lean();
  try {
    return await run();
  } catch (err) {
    if ((err as { code?: number })?.code !== 11000) throw err;
    return await run();
  }
}

/**
 * Keeps DailyLog habits in step with a completion change on `dateString`.
 * Completing ticks the linked habits and remembers which ones it ticked;
 * un-completing removes only those, and only if no other completed event
 * that day still holds them. Habits the user ticked by hand are never removed.
 */
async function syncHabits(
  userId: string,
  event: LeanEvent,
  dateString: string,
  completed: boolean
): Promise<void> {
  if (completed) {
    const linked = await ownedHabitIdsAmong(userId, event.linkedHabitIds || []);
    if (linked.length === 0) return;
    const before = await upsertDailyLog(userId, dateString, {
      $addToSet: { completedHabitIds: { $each: linked } },
    });
    const already = new Set((before?.completedHabitIds || []).map(String));
    const added = linked.filter((id) => !already.has(String(id)));
    await PlannedEvent.updateOne({ _id: event._id, userId }, { $pull: { habitSyncLog: { date: dateString } } });
    if (added.length > 0) {
      await PlannedEvent.updateOne(
        { _id: event._id, userId },
        { $push: { habitSyncLog: { date: dateString, habitIds: added } } }
      );
    }
    return;
  }

  const entry = (event.habitSyncLog || []).find((item) => item.date === dateString);
  await PlannedEvent.updateOne({ _id: event._id, userId }, { $pull: { habitSyncLog: { date: dateString } } });
  const candidates = (entry?.habitIds || []).map(String);
  if (candidates.length === 0) return;

  const others = (await PlannedEvent.find({
    ...candidateEventsFilter(userId, dateString),
    _id: { $ne: event._id },
  })
    .select("date recurrence endDate excludedDates completedDates isCompleted linkedHabitIds habitSyncLog")
    .lean()) as unknown as LeanEvent[];
  const holders = others.filter((other) => occursOn(other, dateString) && isCompletedOn(other, dateString));

  // A habit another completed event still links stays ticked, and that event
  // now owns it, so un-completing it later removes the tick.
  const handOver = new Map<string, string[]>();
  const toRemove: string[] = [];
  for (const habitId of candidates) {
    const holder = holders.find((other) => (other.linkedHabitIds || []).map(String).includes(habitId));
    if (!holder) {
      toRemove.push(habitId);
      continue;
    }
    const key = String(holder._id);
    handOver.set(key, [...(handOver.get(key) || []), habitId]);
  }
  for (const [holderId, habitIds] of handOver) {
    const holder = holders.find((other) => String(other._id) === holderId);
    const existing = (holder?.habitSyncLog || []).find((item) => item.date === dateString)?.habitIds || [];
    const merged = Array.from(new Set([...existing.map(String), ...habitIds])).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    await PlannedEvent.updateOne({ _id: holderId, userId }, { $pull: { habitSyncLog: { date: dateString } } });
    await PlannedEvent.updateOne(
      { _id: holderId, userId },
      { $push: { habitSyncLog: { date: dateString, habitIds: merged } } }
    );
  }
  if (toRemove.length === 0) return;
  await DailyLog.updateOne({ userId, dateString }, { $pull: { completedHabitIds: { $in: toRemove } } });
}

/** Marks one occurrence done or not done. Idempotent; returns the event for that day. */
export async function setCompletion(
  userId: string,
  eventId: string,
  dateString: string,
  completed: boolean
): Promise<PlannerEventDTO> {
  const event = await getOwnedEvent(userId, eventId);
  if (!occursOn(event, dateString)) throw badRequest("This event is not scheduled on that day");

  const update = isRecurring(event)
    ? completed
      ? { $addToSet: { completedDates: dateString } }
      : { $pull: { completedDates: dateString } }
    : { $set: { isCompleted: completed, completedAt: completed ? new Date() : null } };

  const before = (await PlannedEvent.findOneAndUpdate({ _id: eventId, userId }, update, {
    returnDocument: "before",
  }).lean()) as unknown as LeanEvent | null;
  if (!before) throw notFound("Event not found");

  if (isCompletedOn(before, dateString) !== completed) {
    await syncHabits(userId, before, dateString, completed);
  }
  return getEventDTO(userId, eventId, dateString);
}

export async function createEvent(userId: string, input: PlannerEventCreate): Promise<PlannerEventDTO> {
  await getDb();
  await assertOwnedHabits(userId, input.linkedHabitIds);
  const created = await PlannedEvent.create({
    userId,
    date: input.date,
    title: input.title,
    description: input.description,
    startTime: input.startTime,
    endTime: input.endTime,
    category: input.category,
    color: input.color || CATEGORY_COLORS[input.category],
    recurrence: input.recurrence,
    endDate: null,
    completedDates: [],
    excludedDates: [],
    linkedHabitIds: input.linkedHabitIds,
    isCompleted: false,
  });
  return getEventDTO(userId, String(created._id), input.date);
}

/**
 * Applies an AI plan. Everything is validated up front; the new events are
 * inserted first and only then are the events the user chose to replace
 * removed, so a failure can never leave the day empty.
 */
export async function applyPlan(
  userId: string,
  input: PlannerBulkApply
): Promise<{ events: PlannerEventDTO[]; created: number; removed: number }> {
  await getDb();
  await assertOwnedHabits(
    userId,
    input.events.flatMap((event) => event.linkedHabitIds)
  );

  const docs = input.events.map((event) => ({
    _id: new mongoose.Types.ObjectId(),
    userId,
    date: input.date,
    title: event.title,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    category: event.category,
    color: event.color || CATEGORY_COLORS[event.category],
    recurrence: event.recurrence,
    endDate: null,
    completedDates: [],
    excludedDates: [],
    linkedHabitIds: event.linkedHabitIds,
    isCompleted: false,
  }));

  try {
    await Promise.all(docs.map((doc) => new PlannedEvent(doc).validate()));
  } catch {
    throw badRequest("One of the planned events is not valid");
  }

  const replaceable = input.replaceEventIds.length
    ? await PlannedEvent.find({
        _id: { $in: input.replaceEventIds },
        userId,
        date: input.date,
        recurrence: { $in: ["once", null] },
      })
        .select("_id")
        .lean()
    : [];

  try {
    await PlannedEvent.insertMany(docs, { ordered: true });
  } catch (err) {
    await PlannedEvent.deleteMany({ _id: { $in: docs.map((doc) => doc._id) }, userId }).catch(() => undefined);
    throw err;
  }

  let removed = 0;
  if (replaceable.length > 0) {
    const result = await PlannedEvent.deleteMany({ _id: { $in: replaceable.map((doc) => doc._id) }, userId });
    removed = result.deletedCount || 0;
  }

  return { events: await listEventsForDate(userId, input.date), created: docs.length, removed };
}

export async function updateEvent(
  userId: string,
  eventId: string,
  patch: PlannerEventPatch
): Promise<PlannerEventDTO> {
  const event = await getOwnedEvent(userId, eventId);
  const dateString = patch.targetDate;
  if (patch.linkedHabitIds) await assertOwnedHabits(userId, patch.linkedHabitIds);

  const set: Record<string, unknown> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.startTime !== undefined) set.startTime = patch.startTime;
  if (patch.endTime !== undefined) set.endTime = patch.endTime;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.linkedHabitIds !== undefined) set.linkedHabitIds = patch.linkedHabitIds;

  const nextStart = patch.startTime ?? event.startTime;
  const nextEnd = patch.endTime ?? event.endTime ?? "";
  if (nextEnd && !isEndAfterStart(nextStart, nextEnd)) {
    throw badRequest("endTime: End time must be after the start time");
  }

  const currentRecurrence = (event.recurrence || "once") as RecurrenceType;
  if (patch.recurrence && patch.recurrence !== currentRecurrence) {
    if (!occursOn(event, dateString)) throw badRequest("This event is not scheduled on that day");

    // Switching one repeat pattern for another part-way through a series: the
    // old pattern keeps the days before (and their ticks); a new series with
    // the new pattern starts on the day being edited.
    if (currentRecurrence !== "once" && patch.recurrence !== "once" && dateString > event.date) {
      const newId = await splitSeriesWithNewPattern(userId, event, dateString, patch.recurrence, set);
      if (typeof patch.isCompleted === "boolean") return setCompletion(userId, newId, dateString, patch.isCompleted);
      return getEventDTO(userId, newId, dateString);
    }

    const carried = completionAfterRecurrenceChange(event, patch.recurrence, dateString);
    // A one-time event lives on the day it was viewed; a new series starts there.
    const anchor = patch.recurrence === "once" || currentRecurrence === "once" ? dateString : event.date;
    set.recurrence = patch.recurrence;
    set.completedDates = carried.completedDates;
    set.isCompleted = carried.isCompleted;
    set.completedAt = carried.isCompleted ? new Date() : null;
    set.date = anchor;
    // Days already removed from the series and its end stay as they were.
    set.excludedDates = patch.recurrence === "once" ? [] : (event.excludedDates || []).filter((day) => day >= anchor);
    set.endDate = patch.recurrence === "once" || !event.endDate || event.endDate < anchor ? null : event.endDate;
  }

  if (Object.keys(set).length > 0) {
    await PlannedEvent.updateOne({ _id: eventId, userId }, { $set: set }, { runValidators: true });
  }

  if (typeof patch.isCompleted === "boolean") {
    return setCompletion(userId, eventId, dateString, patch.isCompleted);
  }
  return getEventDTO(userId, eventId, dateString);
}

/**
 * Ends `event` the day before `fromDate` and continues it from `fromDate` as a
 * new series with `recurrence` (plus the other edited fields in `set`).
 */
async function splitSeriesWithNewPattern(
  userId: string,
  event: LeanEvent,
  fromDate: string,
  recurrence: RecurrenceType,
  set: Record<string, unknown>
): Promise<string> {
  const doneThatDay = isCompletedOn(event, fromDate);
  const endDate = event.endDate && event.endDate >= fromDate ? event.endDate : null;
  const created = await PlannedEvent.create({
    userId,
    date: fromDate,
    title: event.title,
    description: event.description || "",
    startTime: event.startTime,
    endTime: event.endTime || "",
    category: event.category,
    color: event.color,
    linkedHabitIds: (event.linkedHabitIds || []).map((habit) =>
      habit && typeof habit === "object" && "_id" in habit ? habit._id : habit
    ),
    ...set,
    recurrence,
    endDate,
    excludedDates: (event.excludedDates || []).filter((day) => day >= fromDate),
    completedDates: doneThatDay ? [fromDate] : [],
    isCompleted: false,
    completedAt: null,
  });
  await PlannedEvent.updateOne(
    { _id: event._id, userId },
    {
      $set: { endDate: addDays(fromDate, -1) },
      $pull: { completedDates: { $gte: fromDate }, excludedDates: { $gte: fromDate } },
    }
  );
  return String(created._id);
}

export async function deleteEvent(
  userId: string,
  eventId: string,
  mode: "this" | "following" | "all",
  dateString?: string
): Promise<{ deleted: "occurrence" | "following" | "event" }> {
  const event = await getOwnedEvent(userId, eventId);

  if (isRecurring(event) && mode !== "all") {
    if (!dateString) throw badRequest("date is required to remove part of a series");
    if (mode === "this") {
      await PlannedEvent.updateOne(
        { _id: eventId, userId },
        { $addToSet: { excludedDates: dateString }, $pull: { completedDates: dateString } }
      );
      return { deleted: "occurrence" };
    }
    if (dateString > event.date) {
      // Never moves an earlier end later (a stale screen could otherwise bring days back).
      const endDate = addDays(dateString, -1);
      await PlannedEvent.updateOne(
        { _id: eventId, userId },
        {
          $set: { endDate: event.endDate && event.endDate < endDate ? event.endDate : endDate },
          $pull: { completedDates: { $gte: dateString }, excludedDates: { $gte: dateString } },
        }
      );
      return { deleted: "following" };
    }
  }

  await PlannedEvent.deleteOne({ _id: eventId, userId });
  return { deleted: "event" };
}
