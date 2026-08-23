import React from "react";
import { Metadata } from "next";
import { AdminNutritionClient } from "@/components/admin/AdminNutritionClient";

export const metadata: Metadata = {
  title: "Nutrition Plans — Control Panel",
  description: "Create and assign public and custom nutrition & macro plans to athletes and users.",
};

export default function AdminNutritionPage() {
  return <AdminNutritionClient />;
}
