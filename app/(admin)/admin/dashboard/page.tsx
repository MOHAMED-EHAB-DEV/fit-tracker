import React from "react";
import { Metadata } from "next";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard — Control Panel",
  description: "Platform-wide analytics, user growth, workout volume, and system metrics.",
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
