import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import NutritionPlan from "@/lib/db/models/NutritionPlan";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = searchParams.get("search") || "";
  const isPublic = searchParams.get("isPublic") || "";

  await getDb();

  const filter: any = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (isPublic !== "") filter.isPublic = isPublic === "true";

  const [plans, total] = await Promise.all([
    NutritionPlan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "name email")
      .lean(),
    NutritionPlan.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    plans,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const body = await request.json().catch(() => ({}));
  const { name, description, targetCalories, targetProteinG, targetCarbsG, targetFatG, meals, assignedTo, isPublic } = body;

  if (!name || targetCalories == null) {
    return NextResponse.json(
      { success: false, error: "name and targetCalories are required" },
      { status: 400 }
    );
  }

  await getDb();

  const plan = await NutritionPlan.create({
    name: name.trim(),
    description: description || "",
    targetCalories: Number(targetCalories),
    targetProteinG: Number(targetProteinG) || 0,
    targetCarbsG: Number(targetCarbsG) || 0,
    targetFatG: Number(targetFatG) || 0,
    meals: Array.isArray(meals) ? meals : [],
    assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
    isPublic: Boolean(isPublic),
    createdBy: (result.user as any)._id,
  });

  return NextResponse.json({ success: true, plan }, { status: 201 });
}
