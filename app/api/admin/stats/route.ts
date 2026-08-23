import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Workout from "@/lib/db/models/Workout";
import Meal from "@/lib/db/models/Meal";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import NutritionPlan from "@/lib/db/models/NutritionPlan";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  await getDb();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersThisWeek,
    adminCount,
    bannedCount,
    profileCompleteCount,
    totalWorkouts,
    workoutsThisWeek,
    completedWorkouts,
    totalMeals,
    mealsThisWeek,
    totalExercises,
    customExercises,
    totalNutritionPlans,
    caloriesAgg,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ isBanned: true }),
    User.countDocuments({ isProfileComplete: true }),
    Workout.countDocuments(),
    Workout.countDocuments({ createdAt: { $gte: weekAgo } }),
    Workout.countDocuments({ status: "completed" }),
    Meal.countDocuments(),
    Meal.countDocuments({ createdAt: { $gte: weekAgo } }),
    ExerciseCatalog.countDocuments(),
    ExerciseCatalog.countDocuments({ isCustom: true }),
    NutritionPlan.countDocuments(),
    Meal.aggregate([{ $group: { _id: null, total: { $sum: "$macros.calories" } } }]),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt isProfileComplete isBanned")
      .lean(),
  ]);

  const totalCaloriesLogged = caloriesAgg[0]?.total ?? 0;

  return NextResponse.json({
    success: true,
    stats: {
      users: {
        total: totalUsers,
        newThisWeek: newUsersThisWeek,
        admins: adminCount,
        banned: bannedCount,
        profileComplete: profileCompleteCount,
      },
      workouts: {
        total: totalWorkouts,
        thisWeek: workoutsThisWeek,
        completed: completedWorkouts,
      },
      meals: {
        total: totalMeals,
        thisWeek: mealsThisWeek,
        totalCaloriesLogged: Math.round(totalCaloriesLogged),
      },
      exercises: {
        total: totalExercises,
        custom: customExercises,
        global: totalExercises - customExercises,
      },
      nutritionPlans: {
        total: totalNutritionPlans,
      },
    },
    recentUsers,
  });
}
