import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout, { DayOfWeek } from "@/lib/db/models/Workout";
import { RoutineBuilderClient } from "@/components/workout/RoutineBuilderClient";
import { DefaultExerciseItem, RoutineSetItem } from "@/components/workout/RoutineExerciseCard";

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
    const rawSets = Array.isArray(ex.sets) ? ex.sets : [];

    let setsList: RoutineSetItem[] = [];
    if (rawSets.length > 0) {
      setsList = rawSets.map((s: any, idx: number) => ({
        setNumber: s.setNumber || idx + 1,
        targetReps: s.targetReps ?? (s.completedReps || 10),
        targetWeight: s.targetWeight ?? (s.weight ?? null),
        isWarmup: !!s.isWarmup,
      }));
    } else {
      const warmupCount = ex.isWarmup ? ex.warmupSets || 1 : 0;
      const workingCount = ex.targetSets || 3;
      let sNum = 1;
      for (let i = 0; i < warmupCount; i++) {
        setsList.push({
          setNumber: sNum++,
          targetReps: ex.warmupReps || 12,
          targetWeight:
            ex.warmupWeight ?? (ex.targetWeight ? Math.round(ex.targetWeight * 0.5) : 20),
          isWarmup: true,
        });
      }
      for (let i = 0; i < workingCount; i++) {
        setsList.push({
          setNumber: sNum++,
          targetReps: ex.targetReps || 10,
          targetWeight: ex.targetWeight ?? 50,
          isWarmup: false,
        });
      }
    }

    const warmupSetsList = setsList.filter((s) => s.isWarmup);
    const workingSetsList = setsList.filter((s) => !s.isWarmup);
    const hasWarmup = !!ex.isWarmup || warmupSetsList.length > 0;
    const firstWarmup = warmupSetsList[0];
    const firstWorking = workingSetsList[0] || setsList[0];

    return {
      catalogId: ex.catalogId ? ex.catalogId.toString() : "",
      name: ex.name || "Exercise",
      muscleGroup: ex.muscleGroup || "Other",
      metValue: ex.metValue,
      targetSets: workingSetsList.length || 3,
      targetReps: firstWorking?.targetReps || 10,
      targetWeight: firstWorking?.targetWeight ?? 50,
      weightUnit: (ex.weightUnit || workoutDoc.weightUnit || "kg") as "kg" | "lbs",
      isWarmup: hasWarmup,
      warmupSets: warmupSetsList.length || ex.warmupSets || 1,
      warmupReps: firstWarmup?.targetReps || ex.warmupReps || 12,
      warmupWeight:
        firstWarmup?.targetWeight ??
        ex.warmupWeight ??
        (firstWorking?.targetWeight ? Math.round(firstWorking.targetWeight * 0.5) : 20),
      sets: setsList,
      notes: ex.notes || null,
    };
  });

  const initialWorkout = {
    id: workoutDoc._id.toString(),
    name: workoutDoc.name || "Workout Routine",
    dayOfWeek: ((workoutDoc.dayOfWeek || "saturday").toLowerCase()) as DayOfWeek,
    weightUnit: (workoutDoc.weightUnit || "kg") as "kg" | "lbs",
    userWeightKg: user.fitnessProfile?.weightKg ?? 0,
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
