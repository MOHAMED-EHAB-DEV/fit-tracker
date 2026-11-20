import React from "react";
import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { AdminNutritionClient } from "@/components/admin/AdminNutritionClient";

export const metadata: Metadata = {
  title: "Nutrition plans",
  description: "Create nutrition plans and assign them to users.",
};

export default async function AdminNutritionPage() {
  await requireAdminPage();
  return <AdminNutritionClient />;
}
