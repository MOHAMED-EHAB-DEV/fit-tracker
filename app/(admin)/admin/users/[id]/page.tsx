import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Workout from "@/lib/db/models/Workout";
import Meal from "@/lib/db/models/Meal";
import BodyComp from "@/lib/db/models/BodyComp";
import { AdminUserDetailClient } from "@/components/admin/AdminUserDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "User Profile — Control Panel",
    description: `Manage profile, roles, and stats for user ${id}.`,
  };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || !mongoose.isValidObjectId(id)) {
    notFound();
  }

  await getDb();
  const userDoc = await User.findById(id).lean();

  if (!userDoc) {
    notFound();
  }

  const [workoutCount, mealCount, bodyCompCount] = await Promise.all([
    Workout.countDocuments({ userId: id }),
    Meal.countDocuments({ userId: id }),
    BodyComp.countDocuments({ userId: id }),
  ]);

  const initialUser = {
    _id: (userDoc as any)._id.toString(),
    name: (userDoc as any).name || "",
    email: (userDoc as any).email || "",
    role: (userDoc as any).role || "user",
    isBanned: !!(userDoc as any).isBanned,
    isProfileComplete: !!(userDoc as any).isProfileComplete,
    createdAt: (userDoc as any).createdAt ? new Date((userDoc as any).createdAt).toISOString() : new Date().toISOString(),
    lastLoginAt: (userDoc as any).lastLoginAt ? new Date((userDoc as any).lastLoginAt).toISOString() : null,
    fitnessProfile: {
      sex: (userDoc as any).fitnessProfile?.sex || null,
      age: (userDoc as any).fitnessProfile?.age || null,
      weightKg: (userDoc as any).fitnessProfile?.weightKg || null,
      heightCm: (userDoc as any).fitnessProfile?.heightCm || null,
      activityLevel: (userDoc as any).fitnessProfile?.activityLevel || null,
      goal: (userDoc as any).fitnessProfile?.goal || null,
      targetCalories: (userDoc as any).fitnessProfile?.targetCalories || null,
      targetProteinG: (userDoc as any).fitnessProfile?.targetProteinG || null,
    },
    preferences: {
      stepGoal: (userDoc as any).preferences?.stepGoal || null,
      waterGoalMl: (userDoc as any).preferences?.waterGoalMl || null,
      timezone: (userDoc as any).preferences?.timezone || "UTC",
      weightUnit: (userDoc as any).preferences?.weightUnit || "kg",
    },
    computed: {
      bmr: (userDoc as any).computed?.bmr || null,
      tdee: (userDoc as any).computed?.tdee || null,
    },
  };

  const initialStats = {
    workoutCount,
    mealCount,
    bodyCompCount,
  };

  return <AdminUserDetailClient id={id} initialUser={initialUser} initialStats={initialStats} />;
}
