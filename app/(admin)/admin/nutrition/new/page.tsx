import React from "react";
import { Metadata } from "next";
import { AdminNutritionNewClient } from "@/components/admin/AdminNutritionNewClient";

export const metadata: Metadata = {
  title: "Create Nutrition Plan — Control Panel",
  description: "Configure targets and daily meal templates for a new nutrition plan.",
};

export default function AdminNewNutritionPlanPage() {
  return <AdminNutritionNewClient />;
}
