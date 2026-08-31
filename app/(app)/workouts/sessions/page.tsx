import React, { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import {
  GymSessionsClient,
  SerializedWorkoutSession,
  SerializedExercise,
  SerializedSet,
} from "@/components/workout/GymSessionsClient";

export const metadata: Metadata = {
  title: "Recorded Gym Sessions — AI Fit Tracker",
  description: "Review and analyze your past gym workout sessions, logged sets, volume, and personal records.",
};

async function GymSessionsDataLoader() {
  const user = await getFullUser();
  if (!user) {
    redirect("/login");
  }

  await getDb();

  const rawWorkouts = await Workout.find({ userId: user._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(100)
    .lean();

  const initialSessions: SerializedWorkoutSession[] = rawWorkouts.map((w: any) => {
    const exercises: SerializedExercise[] = (w.exercises || []).map((ex: any) => {
      const sets: SerializedSet[] = (ex.sets || []).map((s: any, idx: number) => ({
        setNumber: s.setNumber || idx + 1,
        targetReps: s.targetReps ?? null,
        targetWeight: s.targetWeight ?? null,
        completedReps: s.completedReps ?? null,
        weight: s.weight ?? null,
        rpe: s.rpe ?? null,
        isWarmup: !!s.isWarmup,
        isPR: !!s.isPR,
        completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
        restSeconds: s.restSeconds ?? null,
      }));

      return {
        catalogId: ex.catalogId ? ex.catalogId.toString() : "",
        name: ex.name || "Exercise",
        muscleGroup: ex.muscleGroup || "Other",
        weightUnit: (ex.weightUnit || w.weightUnit || "kg") as "kg" | "lbs",
        isWarmup: !!ex.isWarmup,
        warmupSets: ex.warmupSets ?? null,
        warmupReps: ex.warmupReps ?? null,
        warmupWeight: ex.warmupWeight ?? null,
        sets,
        notes: ex.notes || null,
        oneRM: ex.oneRM || null,
      };
    });

    return {
      _id: w._id.toString(),
      name: w.name || "Workout Session",
      dayOfWeek: w.dayOfWeek || "saturday",
      templateId: w.templateId ? w.templateId.toString() : null,
      status: (w.status || "completed") as "active" | "completed" | "abandoned",
      startedAt: w.startedAt ? new Date(w.startedAt).toISOString() : new Date().toISOString(),
      completedAt: w.completedAt ? new Date(w.completedAt).toISOString() : null,
      durationSeconds: w.durationSeconds ?? null,
      weekStartDate: w.weekStartDate || "",
      exercises,
      weightUnit: (w.weightUnit || "kg") as "kg" | "lbs",
      totalVolume: w.totalVolume || 0,
      estimatedCalories: w.estimatedCalories || 0,
      date: w.date ? new Date(w.date).toISOString() : new Date().toISOString(),
      createdAt: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  return <GymSessionsClient initialSessions={initialSessions} />;
}

export default function GymSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading recorded gym sessions...</span>
        </div>
      }
    >
      <GymSessionsDataLoader />
    </Suspense>
  );
}
