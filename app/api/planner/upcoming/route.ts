import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import PlannedEvent from "@/lib/db/models/PlannedEvent";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayDateString();

    await getDb();
    const events = await PlannedEvent.find({
      userId: session.userId,
      date,
      isCompleted: false,
    })
      .sort({ startTime: 1 })
      .lean();

    // Map each event to alarm metadata (15 minutes before startTime)
    const upcoming = events.map((event) => {
      const [hours, minutes] = event.startTime.split(":").map(Number);
      const eventDate = new Date(`${event.date}T00:00:00`);
      eventDate.setHours(hours, minutes, 0, 0);

      // Notification time is 15 minutes before
      const notifyTime = new Date(eventDate.getTime() - 15 * 60 * 1000);

      return {
        id: event._id.toString(),
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        date: event.date,
        eventTimestamp: eventDate.getTime(),
        notifyTimestamp: notifyTime.getTime(),
        category: event.category,
      };
    });

    return NextResponse.json({ success: true, upcoming, date });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
