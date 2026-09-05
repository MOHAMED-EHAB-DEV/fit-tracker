import React, { Suspense } from "react";
import Link from "next/link";
import { LayoutTemplate, Plus, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import WorkoutTemplate from "@/lib/db/models/WorkoutTemplate";
import { DEFAULT_WORKOUT_TEMPLATES } from "@/lib/fitness/default-templates";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workout Templates — AI Fit Tracker",
  description: "Browse strength and hypertrophy workout templates or create your own.",
};

async function TemplatesContent() {
  const user = await getFullUser();
  await getDb();

  const dbTemplates = await WorkoutTemplate.find({
    $or: [{ isPublic: true }, { createdBy: user?._id }],
  })
    .sort({ usageCount: -1, createdAt: -1 })
    .lean();

  const allTemplates = [
    ...dbTemplates.map((t: any) => ({ ...t, _id: t._id.toString(), isCurated: false })),
    ...DEFAULT_WORKOUT_TEMPLATES,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Workout Templates
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Select a battle-tested routine or custom template to jumpstart your session
          </p>
        </div>

        <Link
          href="/workouts/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Start Blank Workout</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allTemplates.map((tpl: any) => (
          <div
            key={tpl._id}
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-emerald-500/40 transition flex flex-col justify-between space-y-4 group relative overflow-hidden"
          >
            {tpl.isCurated && (
              <div
                className="absolute -top-10 -inset-e-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"
                aria-hidden="true"
              />
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {tpl.category}
                  </span>
                  {tpl.isCurated && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Curated
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {tpl.daysPerWeek} days/week
                </span>
              </div>
              <h3 className="font-bold text-base text-white group-hover:text-emerald-300 transition">
                {tpl.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {tpl.description || `${tpl.exercises?.length || 0} exercises included`}
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="space-y-1 text-xs text-zinc-400">
                {tpl.exercises?.slice(0, 3).map((ex: any, i: number) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-zinc-300 truncate">{ex.name}</span>
                    <span className="text-zinc-500 shrink-0">
                      {ex.sets} sets × {ex.repRange}
                    </span>
                  </div>
                ))}
                {tpl.exercises?.length > 3 && (
                  <span className="text-[10px] text-zinc-500 italic">
                    +{tpl.exercises.length - 3} more exercises
                  </span>
                )}
              </div>

              <Link
                href={`/workouts/new?templateId=${tpl._id}`}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Use Routine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading templates...</span>
        </div>
      }
    >
      <TemplatesContent />
    </Suspense>
  );
}
