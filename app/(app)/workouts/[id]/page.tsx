import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout, { DayOfWeek } from "@/lib/db/models/Workout";
import { RoutineBuilderClient } from "@/components/workout/RoutineBuilderClient";
import { DefaultExerciseItem } from "@/components/workout/RoutineExerciseCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Edit Routine — AI Fit Tracker`,
    description: "Configure default exercises and target rep ranges for your weekly routine.",
  };
}

async function RoutineBuilderDataLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getFullUser();
  if (!user) {
    redirect("/login");
  }

  await getDb();
  const workoutDoc = await Workout.findOne({
    _id: id,
    userId: user._id,
  }).lean();

  if (!workoutDoc) {
    notFound();
  }

  const mappedExercises: DefaultExerciseItem[] = (workoutDoc.exercises || []).map((ex: any) => {
    const sets = ex.sets || [];
    const warmupSetsList = sets.filter((s: any) => s.isWarmup);
    const workingSetsList = sets.filter((s: any) => !s.isWarmup);

    const hasWarmup = !!ex.isWarmup || warmupSetsList.length > 0;
    const firstWarmup = warmupSetsList[0];
    const firstWorking = workingSetsList[0] || sets[0];

    return {
      catalogId: ex.catalogId ? ex.catalogId.toString() : "",
      name: ex.name || "Exercise",
      muscleGroup: ex.muscleGroup || "Other",
      targetSets:
        workingSetsList.length > 0
          ? workingSetsList.length
          : hasWarmup && warmupSetsList.length === sets.length
          ? 3
          : sets.length || 3,
      targetReps: firstWorking?.targetReps || 10,
      targetWeight: firstWorking?.targetWeight ?? firstWorking?.weight ?? 50,
      weightUnit: (ex.weightUnit || workoutDoc.weightUnit || "kg") as "kg" | "lbs",
      isWarmup: hasWarmup,
      warmupSets: ex.warmupSets || (warmupSetsList.length > 0 ? warmupSetsList.length : 1),
      warmupReps: ex.warmupReps || firstWarmup?.targetReps || 12,
      warmupWeight:
        ex.warmupWeight ??
        firstWarmup?.targetWeight ??
        firstWarmup?.weight ??
        (firstWorking?.targetWeight ? Math.round(firstWorking.targetWeight * 0.5) : 20),
      notes: ex.notes || null,
    };
  });

  const initialWorkout = {
    id: workoutDoc._id.toString(),
    name: workoutDoc.name || "Workout Routine",
    dayOfWeek: ((workoutDoc.dayOfWeek || "saturday").toLowerCase()) as DayOfWeek,
    weightUnit: (workoutDoc.weightUnit || "kg") as "kg" | "lbs",
    exercises: mappedExercises,
  };

  return <RoutineBuilderClient initialWorkout={initialWorkout} />;
}

export default function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading routine...</span>
        </div>
      }
    >
      <RoutineBuilderDataLoader params={params} />
    </Suspense>
  );
}
