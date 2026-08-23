import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import { AdminNutritionDetailClient } from "@/components/admin/AdminNutritionDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Edit Nutrition Plan — Control Panel",
    description: `Configure targets and meals for nutrition plan ${id}.`,
  };
}

export default async function AdminNutritionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || !mongoose.isValidObjectId(id)) {
    notFound();
  }

  await getDb();
  const planDoc = await NutritionPlan.findById(id).lean();

  if (!planDoc) {
    notFound();
  }

  const initialPlan = {
    _id: (planDoc as any)._id.toString(),
    name: (planDoc as any).name || "",
    description: (planDoc as any).description || "",
    targetCalories: (planDoc as any).targetCalories || 0,
    targetProteinG: (planDoc as any).targetProteinG || 0,
    targetCarbsG: (planDoc as any).targetCarbsG || 0,
    targetFatG: (planDoc as any).targetFatG || 0,
    isPublic: !!(planDoc as any).isPublic,
    meals: Array.isArray((planDoc as any).meals) ? (planDoc as any).meals : [],
    assignedTo: Array.isArray((planDoc as any).assignedTo) ? (planDoc as any).assignedTo : [],
  };

  return <AdminNutritionDetailClient id={id} initialPlan={initialPlan} />;
}
