import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import Meal from "@/lib/db/models/Meal";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import { localDateString, weekStartOf, zonedTimeToUtc, type WeekdayKey } from "@/lib/time";
import { toAdminUserRow, type AdminUserRow } from "@/lib/admin/users";

/**
 * Dashboard numbers. "This week" follows the viewing admin's week start and
 * time zone. Week windows use the `_id` index (an ObjectId encodes its
 * creation time) instead of scanning createdAt; totals use collection
 * metadata where an exact filter is not needed. Queries run a few at a time
 * so the dashboard never takes the whole connection pool.
 */

export interface AdminStats {
  week: { start: string; weekStartDay: WeekdayKey; timezone: string };
  users: { total: number; newThisWeek: number; admins: number; banned: number; profileComplete: number };
  workouts: { completedTotal: number; completedThisWeek: number; inProgress: number };
  meals: { total: number; loggedThisWeek: number; caloriesThisWeek: number };
  exercises: { active: number; custom: number; archived: number };
  nutritionPlans: { total: number; assigned: number };
}

interface Viewer {
  timezone: string;
  weekStartDay: WeekdayKey;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: { stats: AdminStats; recentUsers: AdminUserRow[] } }>();

async function inBatches<T>(tasks: Array<() => Promise<T>>, size: number = 3): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < tasks.length; index += size) {
    results.push(...(await Promise.all(tasks.slice(index, index + size).map((task) => task()))));
  }
  return results;
}

export async function getAdminStats(viewer: Viewer, now: Date = new Date()) {
  const today = localDateString(now, viewer.timezone);
  const weekStart = weekStartOf(today, viewer.weekStartDay);
  const cacheKey = `${viewer.timezone}|${weekStart}`;
  const cached = cache.get(cacheKey);
  if (cached && now.getTime() - cached.at < CACHE_MS) return cached.value;

  await getDb();
  const weekStartInstant = zonedTimeToUtc(weekStart, "00:00", viewer.timezone);
  const sinceWeekStart = { _id: { $gte: mongoose.Types.ObjectId.createFromTime(Math.floor(weekStartInstant.getTime() / 1000)) } };

  const [
    usersTotal,
    newUsers,
    admins,
    banned,
    profileComplete,
    inProgress,
    completedThisWeek,
    mealsTotal,
    mealsThisWeek,
    caloriesAgg,
    catalogTotal,
    custom,
    archived,
    plansTotal,
    plansAssigned,
    sessionsTotal,
  ] = await inBatches<unknown>([
    () => User.estimatedDocumentCount(),
    () => User.countDocuments(sinceWeekStart),
    () => User.countDocuments({ role: "admin", isBanned: { $ne: true } }),
    () => User.countDocuments({ isBanned: true }),
    () =>
      User.countDocuments({
        $or: [
          { isProfileComplete: true },
          { "fitnessProfile.weightKg": { $gt: 0 }, "fitnessProfile.heightCm": { $gt: 0 }, "fitnessProfile.sex": { $ne: null } },
        ],
      }),
    () => WorkoutSession.countDocuments({ status: "in_progress" }),
    // Sessions started this week and finished (a session is created when it starts).
    () => WorkoutSession.countDocuments({ ...sinceWeekStart, status: "completed" }),
    () => Meal.estimatedDocumentCount(),
    () => Meal.countDocuments(sinceWeekStart),
    () =>
      Meal.aggregate<{ total: number }>([
        { $match: sinceWeekStart },
        { $group: { _id: null, total: { $sum: "$macros.calories" } } },
      ]),
    () => ExerciseCatalog.estimatedDocumentCount(),
    () => ExerciseCatalog.countDocuments({ isCustom: true }),
    () => ExerciseCatalog.countDocuments({ archivedAt: { $ne: null } }),
    () => NutritionPlan.estimatedDocumentCount(),
    () => NutritionPlan.countDocuments({ "assignedTo.0": { $exists: true } }),
    () => WorkoutSession.estimatedDocumentCount(),
  ]);

  const recent = await User.find()
    .sort({ _id: -1 })
    .limit(5)
    .select("name email role isBanned isProfileComplete createdAt lastLoginAt fitnessProfile.goal fitnessProfile.weightKg fitnessProfile.heightCm fitnessProfile.sex")
    .lean();

  const stats: AdminStats = {
    week: { start: weekStart, weekStartDay: viewer.weekStartDay, timezone: viewer.timezone },
    users: {
      total: usersTotal as number,
      newThisWeek: newUsers as number,
      admins: admins as number,
      banned: banned as number,
      profileComplete: profileComplete as number,
    },
    workouts: {
      // Every session that is not in progress is completed (discarded ones are deleted).
      completedTotal: Math.max(0, (sessionsTotal as number) - (inProgress as number)),
      completedThisWeek: completedThisWeek as number,
      inProgress: inProgress as number,
    },
    meals: {
      total: mealsTotal as number,
      loggedThisWeek: mealsThisWeek as number,
      caloriesThisWeek: Math.round((caloriesAgg as Array<{ total: number }>)[0]?.total ?? 0),
    },
    exercises: {
      active: Math.max(0, (catalogTotal as number) - (archived as number)),
      custom: custom as number,
      archived: archived as number,
    },
    nutritionPlans: { total: plansTotal as number, assigned: plansAssigned as number },
  };

  const value = { stats, recentUsers: (recent as unknown as Parameters<typeof toAdminUserRow>[0][]).map(toAdminUserRow) };
  cache.set(cacheKey, { at: now.getTime(), value });
  return value;
}
