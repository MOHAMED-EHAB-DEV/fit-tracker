import React from "react";
import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export const metadata: Metadata = {
  title: "Users",
  description: "Manage accounts, roles, bans and profiles.",
};

export default async function AdminUsersPage() {
  const admin = await requireAdminPage();
  return <AdminUsersClient currentAdminId={String(admin._id)} />;
}
