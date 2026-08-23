import React from "react";
import { Metadata } from "next";
import { AdminExercisesClient } from "@/components/admin/AdminExercisesClient";

export const metadata: Metadata = {
  title: "Exercise Catalog — Control Panel",
  description: "Manage global and custom exercises, muscle groups, equipment, and MET values.",
};

export default function AdminExercisesPage() {
  return <AdminExercisesClient />;
}
