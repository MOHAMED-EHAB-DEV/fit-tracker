import React from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import mongoose from "mongoose";
import { ExerciseForm, ExerciseFormState } from "@/components/admin/ExerciseForm";

export default async function AdminEditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || !mongoose.isValidObjectId(id)) {
    notFound();
  }

  await getDb();
  const exerciseDoc: any = await ExerciseCatalog.findById(id).lean();

  if (!exerciseDoc) {
    notFound();
  }

  const initialData: ExerciseFormState = {
    _id: exerciseDoc._id.toString(),
    name: exerciseDoc.name || "",
    slug: exerciseDoc.slug || "",
    primaryMuscle: exerciseDoc.primaryMuscle || "",
    secondaryMuscles: Array.isArray(exerciseDoc.secondaryMuscles) ? exerciseDoc.secondaryMuscles : [],
    equipment: exerciseDoc.equipment || "other",
    category: exerciseDoc.category || "strength",
    force: exerciseDoc.force || "",
    level: exerciseDoc.level || "",
    mechanic: exerciseDoc.mechanic || "",
    metValue: exerciseDoc.metValue ?? 5.0,
    instructions:
      Array.isArray(exerciseDoc.instructions) && exerciseDoc.instructions.length > 0
        ? exerciseDoc.instructions
        : [""],
    images: Array.isArray(exerciseDoc.images) ? exerciseDoc.images : [],
    isCustom: !!exerciseDoc.isCustom,
  };

  return <ExerciseForm exerciseId={id} initialData={initialData} mode="edit" />;
}
