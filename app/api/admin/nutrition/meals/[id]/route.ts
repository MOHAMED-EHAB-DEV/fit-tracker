import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid meal ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = ["mealType", "description", "macros", "isManualOverride"];

  const updateData: any = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  await getDb();

  // If macros are changing, update DailyLog accordingly
  if (updateData.macros) {
    const oldMeal = await Meal.findById(id).lean();
    if (oldMeal) {
      const old = (oldMeal as any).macros;
      const next = updateData.macros;
      const delta = {
        caloriesIn: (next.calories ?? old.calories) - old.calories,
        "macros.protein": (next.protein ?? old.protein) - old.protein,
        "macros.carbs": (next.carbs ?? old.carbs) - old.carbs,
        "macros.fat": (next.fat ?? old.fat) - old.fat,
        "macros.fiber": (next.fiber ?? old.fiber) - old.fiber,
      };
      await DailyLog.findOneAndUpdate(
        { userId: (oldMeal as any).userId, dateString: (oldMeal as any).dateString },
        { $inc: delta }
      );
    }
  }

  const meal = await Meal.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!meal) {
    return NextResponse.json({ success: false, error: "Meal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, meal });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid meal ID" }, { status: 400 });
  }

  await getDb();
  const meal = await Meal.findById(id).lean();
  if (!meal) {
    return NextResponse.json({ success: false, error: "Meal not found" }, { status: 404 });
  }

  const m = meal as any;

  // Subtract from daily log
  await DailyLog.findOneAndUpdate(
    { userId: m.userId, dateString: m.dateString },
    {
      $inc: {
        caloriesIn: -m.macros.calories,
        "macros.protein": -m.macros.protein,
        "macros.carbs": -m.macros.carbs,
        "macros.fat": -m.macros.fat,
        "macros.fiber": -m.macros.fiber,
      },
    }
  );

  await Meal.findByIdAndDelete(id);

  return NextResponse.json({ success: true, message: "Meal deleted" });
}
