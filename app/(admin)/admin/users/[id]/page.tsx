import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import mongoose from "mongoose";
import { requireAdminPage } from "@/lib/auth/admin";
import { HttpError } from "@/lib/api/errors";
import { getAdminUserDetail } from "@/lib/admin/users";
import { AdminUserDetailClient } from "@/components/admin/AdminUserDetailClient";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  const detail = await getAdminUserDetail(String(admin._id), id).catch((err: unknown) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });
  return <AdminUserDetailClient initial={detail} />;
}
