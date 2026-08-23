"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, ArrowRight, Play } from "lucide-react";

interface ActiveWorkout {
  _id: string;
  name: string;
  startedAt: string;
  exerciseCount: number;
}

export function ActiveWorkoutResume() {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);

  useEffect(() => {
    // Check if there is an active workout in localStorage or via API
    const checkActive = async () => {
      try {
        const res = await fetch("/api/workouts?status=active");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.workouts && data.workouts.length > 0) {
            const w = data.workouts[0];
            setActiveWorkout({
              _id: w._id,
              name: w.name,
              startedAt: w.startedAt,
              exerciseCount: w.exercises?.length || 0,
            });
          }
        }
      } catch (err) {
        console.error("Failed to check active workout:", err);
      }
    };

    checkActive();
  }, []);

  if (!activeWorkout) return null;

  return (
    <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-500/20 via-teal-500/15 to-zinc-900 border border-emerald-500/30 flex items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold shrink-0 animate-pulse">
          <Play className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Workout in Progress
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <h4 className="font-bold text-sm text-white">{activeWorkout.name}</h4>
        </div>
      </div>

      <Link
        href={`/workouts/${activeWorkout._id}`}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition shadow-md shadow-emerald-500/20 group shrink-0"
      >
        <span>Resume</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

export default ActiveWorkoutResume;
