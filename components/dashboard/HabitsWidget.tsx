"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Check, Plus, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { IHabitData } from "@/components/habits/HabitCard";

interface HabitsWidgetProps {
  habits: IHabitData[];
  initialCompletedHabitIds: string[];
  todayStr: string;
}

export function HabitsWidget({
  habits: initialHabits,
  initialCompletedHabitIds,
  todayStr,
}: HabitsWidgetProps) {
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedHabitIds)
  );

  useEffect(() => {
    setCompletedIds(new Set(initialCompletedHabitIds));
  }, [initialCompletedHabitIds]);

  const handleToggle = async (habitId: string) => {
    const isChecked = completedIds.has(habitId);
    const next = new Set(completedIds);
    if (isChecked) {
      next.delete(habitId);
    } else {
      next.add(habitId);
    }
    setCompletedIds(next);

    try {
      const res = await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId,
          dateString: todayStr,
          action: isChecked ? "uncheck" : "check",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCompletedIds(completedIds);
      } else if (Array.isArray(data.completedHabitIds)) {
        setCompletedIds(new Set(data.completedHabitIds.map(String)));
        router.refresh();
      }
    } catch {
      // rollback
      setCompletedIds(completedIds);
    }
  };

  const total = initialHabits.length;
  const done = completedIds.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 shadow-lg backdrop-blur-md relative overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Daily Rituals
              </span>
              {total > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {done}/{total}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
              Habits Checklist
            </h3>
          </div>
        </div>

        <Link
          href="/habits"
          className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition shrink-0"
        >
          <span>Habit Trends</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Habits or Empty State */}
      {total === 0 ? (
        <div className="py-5 px-4 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs text-zinc-400">
              No daily habits configured yet.
            </p>
          </div>
          <Link
            href="/habits"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Habit</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-3">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Quick checklist items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {initialHabits.slice(0, 6).map((h) => {
              const isChecked = completedIds.has(h._id);
              const color = h.color || "#10b981";
              return (
                <button
                  key={h._id}
                  type="button"
                  onClick={() => handleToggle(h._id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl border text-start transition-all duration-150 cursor-pointer select-none",
                    isChecked
                      ? "bg-zinc-800/80 border-zinc-700/60 shadow-xs"
                      : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/40"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{h.emoji || "⚡"}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold truncate transition-colors",
                        isChecked ? "text-zinc-400 line-through" : "text-zinc-200"
                      )}
                    >
                      {h.name}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 border ms-2",
                      isChecked
                        ? "border-transparent text-zinc-950 font-bold"
                        : "border-zinc-700 bg-zinc-800"
                    )}
                    style={{
                      backgroundColor: isChecked ? color : undefined,
                    }}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          {initialHabits.length > 6 && (
            <div className="pt-1 text-center">
              <Link
                href="/habits"
                className="text-[11px] font-semibold text-zinc-500 hover:text-emerald-400 transition"
              >
                +{initialHabits.length - 6} more habits in full view →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
