import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
  }

  await getDb();
  const plan = await NutritionPlan.findById(id)
    .populate("createdBy", "name email")
    .populate("assignedTo", "name email")
    .lean();

  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, plan });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const allowed = [
    "name", "description", "targetCalories", "targetProteinG",
    "targetCarbsG", "targetFatG", "meals", "assignedTo", "isPublic",
  ];

  const updateData: any = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  await getDb();
  const plan = await NutritionPlan.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).populate("createdBy", "name email");

  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, plan });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid plan ID" }, { status: 400 });
  }

  await getDb();
  const plan = await NutritionPlan.findByIdAndDelete(id);
  if (!plan) {
    return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Nutrition plan deleted" });
}
