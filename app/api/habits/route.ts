import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();
    const habits = await Habit.find({
      userId: session.userId,
      isActive: true,
    }).sort({ order: 1, createdAt: 1 });

    return NextResponse.json({ success: true, habits });
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
    const { name, emoji, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Habit name is required" }, { status: 400 });
    }

    await getDb();

    // Get highest order to append to end
    const lastHabit = await Habit.findOne({ userId: session.userId, isActive: true })
      .sort({ order: -1 })
      .select("order");
    const nextOrder = lastHabit ? (lastHabit.order || 0) + 1 : 0;

    const habit = await Habit.create({
      userId: session.userId,
      name: name.trim(),
      emoji: emoji?.trim() || "⚡",
      color: color?.trim() || "#10b981",
      order: nextOrder,
      isActive: true,
    });

    return NextResponse.json({ success: true, habit });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
