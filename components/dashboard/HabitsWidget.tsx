"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, ChevronRight, Loader2, Pencil, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitDTO } from "@/lib/habits/dto";
import { completionForDay } from "@/lib/habits/completion";
import { DEFAULT_HABIT_EMOJI, safeHabitColor } from "@/lib/habits/colors";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { claimRefresh } from "@/lib/dashboard/stale";
import { HabitFormModal } from "@/components/habits/HabitFormModal";
import { useHabitArchive } from "@/components/habits/useHabitArchive";
import { useHabitLogs } from "@/components/habits/useHabitLogs";
import { useDashboardFreshness } from "@/components/habits/useLiveToday";
import { useToast } from "@/components/ui/Toast";

export interface HabitsWidgetProps {
  /** Active habits in display order (getTodayHabitsData().habits). */
  habits: HabitDTO[];
  /** Today's completed ids, already restricted to active habits. */
  initialCompletedHabitIds: string[];
  /** Today in the user's zone, as rendered on the server. */
  todayStr: string;
  /** The user's IANA zone (session.timezone). */
  timeZone: string;
}

const MAX_VISIBLE = 6;

export function HabitsWidget({ habits, initialCompletedHabitIds, todayStr, timeZone }: HabitsWidgetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const liveToday = useDashboardFreshness(todayStr, timeZone);
  const dayIsStale = liveToday !== todayStr;

  const [habitsList, setHabitsList] = useState<HabitDTO[]>(habits);
  const [prevHabits, setPrevHabits] = useState(habits);
  if (habits !== prevHabits) {
    setPrevHabits(habits);
    setHabitsList(habits);
  }

  const { logsMap, toggle, isPending, hasPending, setDay } = useHabitLogs({ [todayStr]: initialCompletedHabitIds });
  const [prevCompleted, setPrevCompleted] = useState({ todayStr, ids: initialCompletedHabitIds });
  if (prevCompleted.ids !== initialCompletedHabitIds || prevCompleted.todayStr !== todayStr) {
    setPrevCompleted({ todayStr, ids: initialCompletedHabitIds });
    setDay(todayStr, initialCompletedHabitIds);
  }

  const [editing, setEditing] = useState<HabitDTO | null>(null);

  // Refresh the server-rendered dashboard (streak etc.) once toggles settle.
  const refreshTimer = useRef<number | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useEffect(() => {
    if (!needsRefresh || hasPending) return;
    refreshTimer.current = window.setTimeout(() => {
      setNeedsRefresh(false);
      router.refresh();
    }, 1200);
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, [needsRefresh, hasPending, router]);

  const archiveFlow = useHabitArchive({
    onArchived: (habit) => {
      setHabitsList((prev) => prev.filter((h) => h._id !== habit._id));
      setEditing(null);
      setNeedsRefresh(true);
    },
    onRestored: (habit) => {
      setHabitsList((prev) => [...prev.filter((h) => h._id !== habit._id), habit]);
      setNeedsRefresh(true);
    },
  });

  const handleToggle = async (habitId: string, checked: boolean) => {
    const now = getTodayDateString(new Date(), timeZone);
    if (now !== todayStr) {
      toast("A new day has started. Updating your dashboard…", "info");
      if (claimRefresh()) router.refresh();
      return;
    }
    const saved = await toggle(habitId, todayStr, checked);
    if (saved) setNeedsRefresh(true);
  };

  const today = completionForDay(habitsList, logsMap[todayStr], todayStr);
  const completed = new Set(today.completedIds);
  const pct = today.total > 0 ? Math.round((today.completed / today.total) * 100) : 0;

  return (
    <section
      aria-labelledby="habits-widget-title"
      className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 shadow-lg relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0" aria-hidden="true">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Daily Rituals</span>
              {today.total > 0 && (
                <span className="text-xs font-bold px-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {today.completed}/{today.total}
                </span>
              )}
            </div>
            <h3 id="habits-widget-title" className="font-extrabold text-sm sm:text-base text-white mt-0.5">
              Habits Checklist
            </h3>
          </div>
        </div>
        <Link
          href="/habits"
          className="min-h-11 flex items-center gap-1 px-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition shrink-0"
        >
          <span>Habit trends</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>

      {dayIsStale && (
        <p role="status" className="mb-3 flex items-center gap-2 text-xs text-amber-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          A new day has started. Updating…
        </p>
      )}

      {habitsList.length === 0 ? (
        <div className="py-4 px-4 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <p className="text-sm text-zinc-400">No daily habits yet.</p>
          </div>
          <Link
            href="/habits"
            className="min-h-11 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold transition shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add habit</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2 @container">
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Habits completed today"
            className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-3"
          >
            <div className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>

          <ul className="grid grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-3 gap-2">
            {habitsList.slice(0, MAX_VISIBLE).map((habit) => {
              const isChecked = completed.has(habit._id);
              const pending = isPending(todayStr, habit._id);
              const color = safeHabitColor(habit.color);
              return (
                <li
                  key={habit._id}
                  className={cn(
                    "flex items-stretch rounded-xl border transition-colors",
                    isChecked ? "bg-zinc-800/80 border-zinc-700/60" : "bg-zinc-900/50 border-zinc-800/80"
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-busy={pending}
                    aria-label={`${habit.name}: ${isChecked ? "completed" : "not completed"}`}
                    disabled={pending || dayIsStale}
                    onClick={() => handleToggle(habit._id, !isChecked)}
                    className="flex-1 min-w-0 min-h-11 flex items-center gap-2.5 ps-3 pe-2 text-start cursor-pointer disabled:cursor-wait rounded-s-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center border shrink-0",
                        isChecked ? "border-transparent text-zinc-950" : "border-zinc-600 bg-zinc-800"
                      )}
                      style={{ backgroundColor: isChecked ? color : undefined }}
                    >
                      {pending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                      ) : (
                        isChecked && <Check className="w-3.5 h-3.5 stroke-3" />
                      )}
                    </span>
                    <span className="text-base shrink-0" aria-hidden="true">
                      {habit.emoji || DEFAULT_HABIT_EMOJI}
                    </span>
                    <span className={cn("text-sm font-semibold truncate", isChecked ? "text-zinc-400 line-through" : "text-zinc-200")}>
                      {habit.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(habit)}
                    aria-label={`Edit ${habit.name}`}
                    className="w-11 shrink-0 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-e-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>

          {habitsList.length > MAX_VISIBLE && (
            <div className="pt-1 text-center">
              <Link href="/habits" className="inline-flex min-h-11 items-center text-sm font-semibold text-zinc-400 hover:text-emerald-400 transition">
                +{habitsList.length - MAX_VISIBLE} more habits on the Habits page →
              </Link>
            </div>
          )}
        </div>
      )}

      <HabitFormModal
        isOpen={Boolean(editing)}
        habit={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setHabitsList((prev) => prev.map((h) => (h._id === saved._id ? saved : h)));
          setNeedsRefresh(true);
        }}
        onRequestArchive={(habit) => {
          setEditing(null);
          archiveFlow.requestArchive(habit);
        }}
      />
      {archiveFlow.element}
    </section>
  );
}
