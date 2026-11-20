import React from "react";
import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { AdminExercisesClient } from "@/components/admin/AdminExercisesClient";

export const metadata: Metadata = {
  title: "Exercise catalog",
  description: "Manage the exercises users can pick: muscles, equipment, tracking, MET values and media.",
};

export default async function AdminExercisesPage() {
  await requireAdminPage();
  return <AdminExercisesClient />;
}
