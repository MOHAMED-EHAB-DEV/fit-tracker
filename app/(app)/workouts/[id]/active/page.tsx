import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import { ActiveWorkoutSession } from "@/components/workout/ActiveWorkoutSession";
import { ActiveExerciseItem } from "@/components/workout/ActiveExerciseCard";
import { SetData } from "@/components/workout/SetRow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Gym Workout Session — AI Fit Tracker",
    description: "Record your weights, reps, sets, and PRs live in the gym.",
  };
}

async function ActiveWorkoutDataLoader({
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

  const mappedExercises: ActiveExerciseItem[] = (workoutDoc.exercises || []).map((ex: any) => {
    const sets: SetData[] = (ex.sets || []).map((s: any, sIdx: number) => ({
      setNumber: s.setNumber || sIdx + 1,
      targetWeight: s.targetWeight ?? 50,
      targetReps: s.targetReps ?? 10,
      weight: s.weight ?? s.targetWeight ?? null,
      completedReps: s.completedReps ?? s.targetReps ?? null,
      rpe: s.rpe ?? null,
      isWarmup: s.isWarmup ?? false,
      isPR: s.isPR ?? false,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
    }));

    return {
      catalogId: ex.catalogId ? ex.catalogId.toString() : "",
      name: ex.name || "Exercise",
      muscleGroup: ex.muscleGroup || "Other",
      weightUnit: (ex.weightUnit || workoutDoc.weightUnit || "kg") as "kg" | "lbs",
      isWarmup: !!ex.isWarmup || sets.some((s) => s.isWarmup),
      sets: sets.length > 0 ? sets : [
        {
          setNumber: 1,
          targetWeight: 50,
          targetReps: 10,
          weight: null,
          completedReps: null,
          rpe: null,
          isWarmup: !!ex.isWarmup,
          isPR: false,
          completedAt: null,
        },
      ],
      notes: ex.notes || null,
      oneRM: ex.oneRM || null,
    };
  });

  const initialWorkout = {
    id: workoutDoc._id.toString(),
    name: workoutDoc.name || "Gym Session",
    dayOfWeek: workoutDoc.dayOfWeek || "saturday",
    weightUnit: (workoutDoc.weightUnit || "kg") as "kg" | "lbs",
    exercises: mappedExercises,
  };

  return <ActiveWorkoutSession initialWorkout={initialWorkout} />;
}

export default function ActiveWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading gym recording sheet...</span>
        </div>
      }
    >
      <ActiveWorkoutDataLoader params={params} />
    </Suspense>
  );
}
