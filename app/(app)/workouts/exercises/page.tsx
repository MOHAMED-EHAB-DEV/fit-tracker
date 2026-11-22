import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth/session";
import { ExerciseLibrary } from "@/components/workout/ExerciseLibrary";
import { TrainNav } from "@/components/workout/TrainNav";

export const metadata: Metadata = {
  title: "Exercises",
  description: "Search the exercise library, see your records and progress, and manage your own exercises.",
};

export default async function ExercisesPage() {
  await requirePageSession();
  return (
    <div className="space-y-3">
      <TrainNav current="exercises" />
      <ExerciseLibrary />
    </div>
  );
}
