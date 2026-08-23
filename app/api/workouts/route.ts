import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import { getWeekStartDateString } from "@/lib/fitness/timezone";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    await getDb();

    const query: any = { userId: session.userId };
    if (status) {
      query.status = status;
    }

    const workouts = await Workout.find(query)
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, workouts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, templateId, exercises } = body;

    await getDb();

    const workoutDate = body.startedAt || body.date ? new Date(body.startedAt || body.date) : new Date();
    const weekStartDate = getWeekStartDateString(workoutDate);
    const dayOfWeek = (body.dayOfWeek || "saturday").toLowerCase();

    const workout = await Workout.create({
      userId: session.userId,
      name: name?.trim() || "Workout",
      dayOfWeek,
      templateId: templateId || null,
      status: body.status || "completed",
      startedAt: workoutDate,
      weekStartDate,
      exercises: exercises || [],
      date: workoutDate,
    });

    return NextResponse.json({ success: true, workout }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
