import React from "react";
import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { getServerSession } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/admin/stats";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Platform-wide numbers: users, workouts, meals, exercises and nutrition plans.",
};

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const session = await getServerSession();
  const { stats, recentUsers } = await getAdminStats({
    timezone: session?.timezone || "UTC",
    weekStartDay: session?.weekStartDay || "saturday",
  });
  return <AdminDashboardClient initialStats={stats} initialRecentUsers={recentUsers} />;
}
