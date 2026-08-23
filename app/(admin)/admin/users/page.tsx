import React from "react";
import { Metadata } from "next";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export const metadata: Metadata = {
  title: "User Management — Control Panel",
  description: "Manage registered user accounts, roles, access permissions, and profiles.",
};

export default function AdminUsersPage() {
  return <AdminUsersClient />;
}
