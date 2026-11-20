import React from "react";
import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { NutritionPlanForm } from "@/components/admin/NutritionPlanForm";

export const metadata: Metadata = {
  title: "New nutrition plan",
  description: "Set targets and a daily meal template for a new nutrition plan.",
};

export default async function AdminNewNutritionPlanPage() {
  await requireAdminPage();
  return <NutritionPlanForm />;
}
