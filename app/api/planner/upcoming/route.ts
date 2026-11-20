import { ok, route } from "@/lib/api/route";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent from "@/lib/db/models/PlannedEvent";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { addDays } from "@/lib/time";
import {
  expandOccurrences,
  reminderWindowDates,
  type ReminderEventInput,
} from "@/lib/planner-reminders/occurrences";

/** Minutes before an event's start time at which the phone reminds the user. */
const REMINDER_LEAD_MINUTES = 15;
/** Safety cap on how many events one user's expansion reads. */
const MAX_EVENTS = 500;

interface LeanPlannedEvent {
  _id: { toString(): string };
  title?: string;
  description?: string;
  category?: string;
  date?: string;
  endDate?: string | null;
  startTime?: string;
  recurrence?: string | null;
  excludedDates?: string[];
  completedDates?: string[];
  isCompleted?: boolean;
}

/**
 * Reminder occurrences for the user's today and tomorrow (in their time
 * zone), recurrence expanded, as exact UTC instants. Used by the Android app
 * to schedule notifications.
 */
export const GET = route({}, async ({ session }) => {
  const now = new Date();
  const timeZone = session.timezone;
  const dates = reminderWindowDates(getTodayDateString(now, timeZone));
  const [today, tomorrow] = dates;
  const yesterday = addDays(today, -1);

  await getDb();
  const events = await PlannedEvent.find({
    userId: session.userId,
    date: { $lte: tomorrow },
    $or: [
      // Series that have not ended before today ("delete following" leaves ended ones behind).
      { recurrence: { $in: ["daily", "weekly", "monthly"] }, $or: [{ endDate: null }, { endDate: { $gte: yesterday } }] },
      { date: { $gte: yesterday } },
    ],
  })
    .select("title description category date endDate startTime recurrence excludedDates completedDates isCompleted")
    // Deterministic when a user has more than the cap: the newest first.
    .sort({ date: -1, _id: -1 })
    .limit(MAX_EVENTS)
    .lean<LeanPlannedEvent[]>();

  const inputs: ReminderEventInput[] = events.map((event) => ({
    id: event._id.toString(),
    title: event.title || "",
    description: event.description,
    category: event.category,
    date: event.date || "",
    endDate: event.endDate,
    startTime: event.startTime,
    recurrence: event.recurrence,
    excludedDates: event.excludedDates,
    completedDates: event.completedDates,
    isCompleted: event.isCompleted,
  }));

  const reminders = expandOccurrences(inputs, {
    // Yesterday's plan too: its late-night blocks (00:00-04:59) happen tonight.
    dates: [yesterday, ...dates],
    timeZone,
    now,
    leadMinutes: REMINDER_LEAD_MINUTES,
  });

  return ok(
    {
      timeZone,
      generatedAt: now.toISOString(),
      leadMinutes: REMINDER_LEAD_MINUTES,
      dates,
      // Soonest first; the phone schedules at most 60 alarms.
      reminders: reminders.slice(0, 60),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
