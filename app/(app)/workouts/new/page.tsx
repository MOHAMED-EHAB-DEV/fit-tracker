"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, ArrowRight, LayoutTemplate, Loader2, Calendar } from "lucide-react";
import { DayOfWeek } from "@/lib/db/models/Workout";
import { DAYS_OF_WEEK } from "@/constants/workout";

export function NewWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("saturday");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateWorkoutSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} Workout`,
          dayOfWeek,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create workout sheet");
      }

      router.push(`/workouts/${data.workout._id}`);
    } catch (err: any) {
      console.error("Create workout error:", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-4">
      <div className="p-6 md:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Create Workout Sheet</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Assign to a day of the week to record your weights & target progression
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateWorkoutSheet} className="space-y-5">
          {/* Day of Week Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assigned Day of the Week</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = dayOfWeek === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDayOfWeek(d.key)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition text-center border ${
                      isSelected
                        ? "bg-emerald-500 text-zinc-950 border-emerald-500 shadow-md shadow-emerald-500/20"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {d.label.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workout Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Workout Routine Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day (Chest & Triceps), Heavy Legs..."
              autoFocus
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700/60 rounded-2xl text-white font-semibold placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold rounded-2xl shadow-lg shadow-emerald-500/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Open Workout Log Sheet</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-400">Prefer a structured split?</span>
          <Link
            href="/workouts/templates"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>Select a Template</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NewWorkoutPage;
