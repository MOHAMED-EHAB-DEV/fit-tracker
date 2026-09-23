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
  });

  if (!workoutDoc) {
    notFound();
  }

  const { isWorkoutStaleIncomplete, cleanStaleWorkout } = await import("@/lib/fitness/daily-log-sync");
  const { getTodayDateString } = await import("@/lib/fitness/timezone");

  const todayStr = getTodayDateString(new Date());
  const lastUpdateDay = getTodayDateString(
    workoutDoc.updatedAt || workoutDoc.completedAt || workoutDoc.startedAt || workoutDoc.createdAt
  );
  const isDifferentDay = todayStr > lastUpdateDay;

  // If incomplete and last touched on an earlier date, wipe stale sets in DB
  if (isWorkoutStaleIncomplete(workoutDoc)) {
    await cleanStaleWorkout(workoutDoc);
  }

  // If this workout was already completed on a past date, provide a completely clean sheet for today's session
  const shouldCleanForNewSession = isDifferentDay;

  const mappedExercises: ActiveExerciseItem[] = (workoutDoc.exercises || []).map((ex: any) => {
    const sets: SetData[] = (ex.sets || []).map((s: any, sIdx: number) => ({
      setNumber: s.setNumber || sIdx + 1,
      targetWeight: s.targetWeight ?? 50,
      targetReps: s.targetReps ?? 10,
      weight: shouldCleanForNewSession ? null : (s.weight ?? null),
      completedReps: shouldCleanForNewSession ? null : (s.completedReps ?? null),
      rpe: shouldCleanForNewSession ? null : (s.rpe ?? null),
      isWarmup: s.isWarmup ?? false,
      isPR: shouldCleanForNewSession ? false : (s.isPR ?? false),
      completedAt: shouldCleanForNewSession || !s.completedAt ? null : new Date(s.completedAt).toISOString(),
    }));

    return {
      catalogId: ex.catalogId ? ex.catalogId.toString() : "",
      name: ex.name || "Exercise",
      muscleGroup: ex.muscleGroup || "Other",
      metValue: ex.metValue,
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
      oneRM: shouldCleanForNewSession ? null : (ex.oneRM || null),
    };
  });

  const initialWorkout = {
    id: workoutDoc._id.toString(),
    name: workoutDoc.name || "Gym Session",
    dayOfWeek: workoutDoc.dayOfWeek || "saturday",
    weightUnit: (workoutDoc.weightUnit || "kg") as "kg" | "lbs",
    userWeightKg: user.fitnessProfile?.weightKg ?? 0,
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
