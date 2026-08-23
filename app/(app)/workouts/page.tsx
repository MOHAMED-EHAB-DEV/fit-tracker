import React, { Suspense } from "react";
import Link from "next/link";
import { Dumbbell, Plus, LayoutTemplate, Calendar, Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Workout from "@/lib/db/models/Workout";
import { WorkoutListCard } from "@/components/workout/WorkoutListCard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workouts & Weekly Training — AI Fit Tracker",
  description: "Log your resistance training sessions by day of the week, track volume, and achieve new PRs.",
};

async function WorkoutsContent() {
  const user = await getFullUser();
  await getDb();

  const workouts = await Workout.find({ userId: user?._id })
    .sort({ createdAt: -1 })
    .limit(35)
    .lean();

  const totalVolume = workouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

  return (
    <div className="space-y-6 w-full max-w-[1800px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Weekly Routine Logs
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Log your workouts by day of the week, target progressive overload, and record your stats
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/workouts/templates"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
          >
            <LayoutTemplate className="w-4 h-4" />
            <span>Templates</span>
          </Link>

          <Link
            href="/workouts/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log New Workout</span>
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Total Lifted Volume
          </span>
          <span className="text-2xl md:text-3xl font-extrabold text-white">
            {totalVolume.toLocaleString()} <span className="text-xs font-medium text-zinc-500">kg</span>
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Completed Sessions
          </span>
          <span className="text-2xl md:text-3xl font-extrabold text-emerald-400">
            {workouts.length}
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Active Routine Split
          </span>
          <span className="text-xl md:text-2xl font-extrabold text-white">
            7 Days Scheduled
          </span>
        </div>
      </div>

      {/* Workout Logs List */}
      <div className="p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <h3 className="font-bold text-base text-white">Logged Workout Sheets</h3>

        {workouts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
            <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-300">No workout logs yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Select a day of the week to create your workout target sheet and record your weights
            </p>
            <Link
              href="/workouts/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workout Sheet</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map((w: any) => (
              <WorkoutListCard
                key={w._id.toString()}
                workout={{
                  id: w._id.toString(),
                  name: w.name,
                  dayOfWeek: w.dayOfWeek || "saturday",
                  exercisesCount: w.exercises?.length || 0,
                  totalVolume: w.totalVolume || 0,
                  estimatedCalories: w.estimatedCalories || 0,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkoutsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading workouts...</span>
        </div>
      }
    >
      <WorkoutsContent />
    </Suspense>
  );
}
