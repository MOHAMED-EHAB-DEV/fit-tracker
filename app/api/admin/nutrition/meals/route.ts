import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
  const userId = searchParams.get("userId") || "";
  const mealType = searchParams.get("mealType") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const imageSource = searchParams.get("imageSource") || "";

  await getDb();

  const filter: any = {};
  if (userId) filter.userId = userId;
  if (mealType) filter.mealType = mealType;
  if (imageSource) filter.imageSource = imageSource;
  if (dateFrom || dateTo) {
    filter.dateString = {};
    if (dateFrom) filter.dateString.$gte = dateFrom;
    if (dateTo) filter.dateString.$lte = dateTo;
  }

  const [meals, total] = await Promise.all([
    Meal.find(filter)
      .sort({ loggedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email")
      .lean(),
    Meal.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    meals,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
