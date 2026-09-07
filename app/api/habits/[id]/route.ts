import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, emoji, color, order, isActive } = body;

    await getDb();

    const updateFields: any = {};
    if (typeof name === "string" && name.trim()) updateFields.name = name.trim();
    if (typeof emoji === "string") updateFields.emoji = emoji.trim();
    if (typeof color === "string") updateFields.color = color.trim();
    if (typeof order === "number") updateFields.order = order;
    if (typeof isActive === "boolean") updateFields.isActive = isActive;

    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedHabit) {
      return NextResponse.json({ success: false, error: "Habit not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, habit: updatedHabit });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await getDb();

    const deleted = await Habit.findOneAndUpdate(
      { _id: id, userId: session.userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Habit not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Habit deactivated" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
