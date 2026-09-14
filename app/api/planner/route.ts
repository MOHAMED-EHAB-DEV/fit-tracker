import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent, { RecurrenceType } from "@/lib/db/models/PlannedEvent";
import Habit from "@/lib/db/models/Habit";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { parseISO, getDay, getDate } from "date-fns";
import { sortEventsByPlannerTime } from "@/lib/planner/time-sort";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayDateString();

    await getDb();

    // 1. Fetch one-time events for this date
    // 2. Fetch recurring events starting on or before this date
    const [oneTimeEvents, recurringEvents] = await Promise.all([
      PlannedEvent.find({
        userId: session.userId,
        date,
        recurrence: { $in: ["once", null] },
      })
        .populate("linkedHabitIds", "name emoji color")
        .lean(),
      PlannedEvent.find({
        userId: session.userId,
        date: { $lte: date },
        recurrence: { $in: ["daily", "weekly", "monthly"] },
      })
        .populate("linkedHabitIds", "name emoji color")
        .lean(),
    ]);

    const targetParsed = parseISO(date);
    const targetDayOfWeek = getDay(targetParsed); // 0 (Sun) - 6 (Sat)
    const targetDayOfMonth = getDate(targetParsed); // 1 - 31

    // Filter matching recurring events
    const matchingRecurring = recurringEvents.filter((event) => {
      // Skip if explicitly excluded on this date
      if (event.excludedDates && event.excludedDates.includes(date)) {
        return false;
      }

      if (event.recurrence === "daily") {
        return true;
      }

      const eventParsed = parseISO(event.date);
      if (event.recurrence === "weekly") {
        return getDay(eventParsed) === targetDayOfWeek;
      }

      if (event.recurrence === "monthly") {
        return getDate(eventParsed) === targetDayOfMonth;
      }

      return false;
    });

    // Project isCompleted for target date
    const formattedOneTime = oneTimeEvents.map((evt) => ({
      ...evt,
      isCompleted: Boolean(evt.isCompleted),
    }));

    const formattedRecurring = matchingRecurring.map((evt) => ({
      ...evt,
      isCompleted:
        Array.isArray(evt.completedDates) && evt.completedDates.includes(date),
    }));

    // Merge and sort from 5:00 AM to 12:00 AM
    const mergedEvents = sortEventsByPlannerTime([
      ...formattedOneTime,
      ...formattedRecurring,
    ]);

    return NextResponse.json({ success: true, events: mergedEvents, date });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    await getDb();

    // Bulk insert support (e.g. from AI planner)
    if (Array.isArray(body.events)) {
      const targetDate = body.date || getTodayDateString();
      const eventsToCreate = body.events.map((evt: any) => {
        const linkedHabitIds = Array.isArray(evt.linkedHabitIds)
          ? evt.linkedHabitIds
          : [];
        const recurrence: RecurrenceType =
          evt.recurrence || (linkedHabitIds.length > 0 ? "daily" : "once");

        return {
          userId: session.userId,
          date: evt.date || targetDate,
          title: evt.title?.trim() || "Untitled Event",
          description: evt.description?.trim() || "",
          startTime: evt.startTime?.trim() || "09:00",
          endTime: evt.endTime?.trim() || "",
          category: evt.category || "other",
          color: evt.color || "#10b981",
          recurrence,
          completedDates: [],
          excludedDates: [],
          linkedHabitIds,
          isCompleted: false,
        };
      });

      if (body.replaceExisting) {
        await PlannedEvent.deleteMany({
          userId: session.userId,
          date: targetDate,
          recurrence: { $in: ["once", null] },
        });
      }

      const createdEvents = await PlannedEvent.insertMany(eventsToCreate);
      const populatedEvents = await PlannedEvent.find({
        _id: { $in: createdEvents.map((e) => e._id) },
      })
        .populate("linkedHabitIds", "name emoji color")
        .sort({ startTime: 1 })
        .lean();

      return NextResponse.json({
        success: true,
        events: sortEventsByPlannerTime(populatedEvents as any),
      });
    }

    // Single event create
    const { date, title, description, startTime, endTime, category, color } =
      body;

    const linkedHabitIds = Array.isArray(body.linkedHabitIds)
      ? body.linkedHabitIds
      : [];
    const recurrence: RecurrenceType =
      body.recurrence || (linkedHabitIds.length > 0 ? "daily" : "once");

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 },
      );
    }
    if (!startTime || !startTime.trim()) {
      return NextResponse.json(
        { success: false, error: "Start time is required" },
        { status: 400 },
      );
    }

    const event = await PlannedEvent.create({
      userId: session.userId,
      date: date || getTodayDateString(),
      title: title.trim(),
      description: description?.trim() || "",
      startTime: startTime.trim(),
      endTime: endTime?.trim() || "",
      category: category || "other",
      color: color || "#10b981",
      recurrence,
      completedDates: [],
      excludedDates: [],
      linkedHabitIds,
      isCompleted: false,
    });

    const populated = await PlannedEvent.findById(event._id)
      .populate("linkedHabitIds", "name emoji color")
      .lean();

    return NextResponse.json({ success: true, event: populated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
