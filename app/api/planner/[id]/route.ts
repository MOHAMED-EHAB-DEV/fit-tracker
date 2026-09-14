import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent, { RecurrenceType } from "@/lib/db/models/PlannedEvent";
import DailyLog from "@/lib/db/models/DailyLog";
import Habit from "@/lib/db/models/Habit";
import {
  getCairoMidnightUTC,
  getTodayDateString,
} from "@/lib/fitness/timezone";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    await getDb();
    const event = await PlannedEvent.findOne({
      _id: id,
      userId: session.userId,
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const targetDateStr = body.targetDate || event.date || getTodayDateString();

    // Update habits & recurrence if provided
    if (Array.isArray(body.linkedHabitIds)) {
      event.linkedHabitIds = body.linkedHabitIds;
    }
    if (body.recurrence) {
      event.recurrence = body.recurrence as RecurrenceType;
    }

    // Update standard fields
    if (typeof body.title === "string") event.title = body.title.trim();
    if (typeof body.description === "string")
      event.description = body.description.trim();
    if (typeof body.startTime === "string")
      event.startTime = body.startTime.trim();
    if (typeof body.endTime === "string") event.endTime = body.endTime.trim();
    if (typeof body.category === "string") event.category = body.category;
    if (typeof body.color === "string") event.color = body.color;

    const wasCompleted =
      event.recurrence === "once"
        ? Boolean(event.isCompleted)
        : (event.completedDates || []).includes(targetDateStr);

    const isCompletedProvided = typeof body.isCompleted === "boolean";
    const nowCompleted = isCompletedProvided ? body.isCompleted : wasCompleted;

    if (isCompletedProvided) {
      if (event.recurrence === "once") {
        event.isCompleted = nowCompleted;
        event.completedAt = nowCompleted ? new Date() : null;
      } else {
        // Recurring event: update completedDates set
        const currentCompletedDates = new Set(event.completedDates || []);
        if (nowCompleted) {
          currentCompletedDates.add(targetDateStr);
        } else {
          currentCompletedDates.delete(targetDateStr);
        }
        event.completedDates = Array.from(currentCompletedDates);
      }
    }

    await event.save();

    // DailyLog habit sync: whenever event has linkedHabitIds, ensure DailyLog is updated on completion
    if (
      isCompletedProvided &&
      wasCompleted !== nowCompleted &&
      event.linkedHabitIds &&
      event.linkedHabitIds.length > 0
    ) {
      const targetDate = getCairoMidnightUTC(
        new Date(`${targetDateStr}T12:00:00.000Z`),
      );

      if (nowCompleted) {
        // Mark all habits as completed in DailyLog
        await DailyLog.findOneAndUpdate(
          { userId: session.userId, dateString: targetDateStr },
          {
            $addToSet: { completedHabitIds: { $each: event.linkedHabitIds } },
            $set: { date: targetDate },
            $setOnInsert: {
              userId: session.userId,
              dateString: targetDateStr,
            },
          },
          { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
        );
      } else {
        // Check other completed events for targetDateStr
        const [otherOnceEvents, otherRecurringEvents] = await Promise.all([
          PlannedEvent.find({
            userId: session.userId,
            date: targetDateStr,
            _id: { $ne: event._id },
            isCompleted: true,
            recurrence: { $in: ["once", null] },
          }).select("linkedHabitIds"),
          PlannedEvent.find({
            userId: session.userId,
            _id: { $ne: event._id },
            recurrence: { $in: ["daily", "weekly", "monthly"] },
            completedDates: targetDateStr,
          }).select("linkedHabitIds"),
        ]);

        const allOtherHabitIds = [
          ...otherOnceEvents.flatMap((e) => e.linkedHabitIds || []),
          ...otherRecurringEvents.flatMap((e) => e.linkedHabitIds || []),
        ].map((h: any) => h.toString());

        const stillCompletedHabitIds = new Set(allOtherHabitIds);

        const habitsToRemove = event.linkedHabitIds
          .map((h: any) => h.toString())
          .filter((hid) => !stillCompletedHabitIds.has(hid));

        if (habitsToRemove.length > 0) {
          await DailyLog.findOneAndUpdate(
            { userId: session.userId, dateString: targetDateStr },
            {
              $pull: { completedHabitIds: { $in: habitsToRemove } },
            },
          );
        }
      }
    }

    const populated: any = await PlannedEvent.findById(event._id)
      .populate("linkedHabitIds", "name emoji color")
      .lean();

    if (populated) {
      populated.isCompleted =
        populated.recurrence === "once"
          ? Boolean(populated.isCompleted)
          : (populated.completedDates || []).includes(targetDateStr);
    }

    return NextResponse.json({ success: true, event: populated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "all"; // "this" or "all"
    const targetDate = searchParams.get("date");

    await getDb();

    const event = await PlannedEvent.findOne({
      _id: id,
      userId: session.userId,
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    // If deleting only this occurrence of a recurring event
    if (mode === "this" && targetDate && event.recurrence !== "once") {
      await PlannedEvent.findByIdAndUpdate(id, {
        $addToSet: { excludedDates: targetDate },
      });
      return NextResponse.json({
        success: true,
        deletedOccurrenceDate: targetDate,
        eventId: id,
      });
    }

    // Otherwise delete full event document
    await PlannedEvent.findByIdAndDelete(id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
