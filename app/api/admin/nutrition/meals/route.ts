import { route, ok } from "@/lib/api/route";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import { adminMealListQuery } from "@/lib/validation/admin";

/** Meal moderation list (no UI yet). Image URLs of private photos are not exposed. */
export const GET = route({ auth: "admin", query: adminMealListQuery }, async ({ query }) => {
  await getDb();
  const filter: Record<string, unknown> = {};
  if (query.userId) filter.userId = query.userId;
  if (query.mealType) filter.mealType = query.mealType;
  if (query.imageSource) filter.imageSource = query.imageSource;
  if (query.dateFrom || query.dateTo) {
    filter.dateString = {
      ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
      ...(query.dateTo ? { $lte: query.dateTo } : {}),
    };
  }

  const [meals, total] = await Promise.all([
    Meal.find(filter)
      .sort({ loggedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("userId mealType description dateString loggedAt imageSource macros isManualOverride createdAt")
      .populate("userId", "name email")
      .lean(),
    Meal.countDocuments(filter),
  ]);

  return ok({
    meals,
    pagination: { total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  });
});
