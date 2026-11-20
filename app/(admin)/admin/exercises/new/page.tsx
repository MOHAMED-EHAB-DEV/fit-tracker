import { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { ExerciseForm } from "@/components/admin/ExerciseForm";

export const metadata: Metadata = { title: "New exercise" };

export default async function AdminNewExercisePage() {
  await requireAdminPage();
  return <ExerciseForm mode="create" />;
}
