import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import mongoose from "mongoose";
import { requireAdminPage } from "@/lib/auth/admin";
import { HttpError } from "@/lib/api/errors";
import { getPlan } from "@/lib/admin/nutrition-plans";
import { NutritionPlanForm } from "@/components/admin/NutritionPlanForm";

export const metadata: Metadata = { title: "Edit nutrition plan" };

export default async function AdminNutritionEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  const plan = await getPlan(id).catch((err: unknown) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });
  return <NutritionPlanForm initialPlan={plan} />;
}
