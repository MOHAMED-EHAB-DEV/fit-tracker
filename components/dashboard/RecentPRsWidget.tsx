"use client";

import { useId } from "react";
import Link from "next/link";
import { Trophy, Flame } from "lucide-react";

export interface IRecentPR {
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  oneRM: number;
  dateString: string;
  workoutId: string;
  workoutName: string;
}

interface RecentPRsWidgetProps {
  prs: IRecentPR[];
}

export function RecentPRsWidget({ prs }: RecentPRsWidgetProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4 flex flex-col justify-between"
    >
      {/* Semantic Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <h3 id={headingId} className="font-bold text-base text-white">
            Recent PRs & Milestones
          </h3>
        </div>
        <span aria-label={`${prs.length} personal records achieved`} className="text-xs font-medium text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 tabular-nums">
          {prs.length} Records
        </span>
      </header>

      {/* PR Cards List */}
      {prs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-2xl space-y-2">
          <Trophy aria-hidden="true" className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-xs font-semibold text-zinc-300">No PRs recorded yet</p>
          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
            Log your workouts with progressive overload to automatically trigger new Personal Records!
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5 list-none">
          {prs.map((pr, i) => (
            <li key={i}>
              <Link
                href={`/workouts/${pr.workoutId}`}
                aria-label={`${pr.exerciseName}: ${pr.weight}kg for ${pr.reps} reps, estimated one rep max ${pr.oneRM}kg`}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-amber-500/40 hover:bg-zinc-900/90 transition group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div aria-hidden="true" className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-zinc-200 group-hover:text-white truncate">
                        {pr.exerciseName}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                        {pr.muscleGroup}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5 truncate">
                      <span className="tabular-nums">{pr.weight} kg × {pr.reps} reps</span>
                      <span>•</span>
                      <span className="truncate">{pr.workoutName}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">1RM Est.</span>
                  <span className="text-sm font-extrabold text-amber-300 tabular-nums">
                    {pr.oneRM} kg
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RecentPRsWidget;
