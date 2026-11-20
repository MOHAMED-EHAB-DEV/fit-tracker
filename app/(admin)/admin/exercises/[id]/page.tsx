import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { requireAdminPage } from "@/lib/auth/admin";
import { HttpError } from "@/lib/api/errors";
import { getAdminExercise } from "@/lib/admin/exercises";
import { ExerciseForm } from "@/components/admin/ExerciseForm";

export const metadata: Metadata = { title: "Edit exercise" };

export default async function AdminEditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  const exercise = await getAdminExercise(id).catch((err: unknown) => {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  });
  return <ExerciseForm mode="edit" initialExercise={exercise} />;
}
