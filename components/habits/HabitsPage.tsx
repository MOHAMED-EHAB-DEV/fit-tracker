"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, CheckSquare, Flame, Loader2 } from "lucide-react";
import { HabitCard, IHabitData } from "./HabitCard";
import { AddHabitModal } from "./AddHabitModal";
import { EditHabitModal } from "./EditHabitModal";
import { HabitWaveChart, IHabitHistoryPoint } from "./HabitWaveChart";
import {
  format,
  subDays,
  addDays,
  startOfWeek,
  parseISO,
  startOfMonth,
  getDaysInMonth,
  subMonths,
} from "date-fns";

interface HabitsPageProps {
  initialHabits: IHabitData[];
  initialCompletedHabitIds: string[];
  todayStr: string;
}

export function HabitsPage({
  initialHabits,
  initialCompletedHabitIds,
  todayStr,
}: HabitsPageProps) {
  const router = useRouter();
  const [habits, setHabits] = useState<IHabitData[]>(initialHabits);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedHabitIds)
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<IHabitData | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState<number>(0);
  const [logsMap, setLogsMap] = useState<Record<string, string[]>>({
    [todayStr]: initialCompletedHabitIds,
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCompletedIds(new Set(initialCompletedHabitIds));
    setLogsMap((prev) => ({
      ...prev,
      [todayStr]: initialCompletedHabitIds,
    }));
  }, [initialCompletedHabitIds, todayStr]);

  // Compute dates array based on viewMode and offset
  const { dateRangeList, fromDateStr, toDateStr } = React.useMemo(() => {
    const today = parseISO(todayStr);

    if (viewMode === "week") {
      // 7 days window starting from Saturday (weekStartsOn: 6)
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 6 });
      const targetWeekStart = subDays(currentWeekStart, offset * 7);

      const days: { dateStr: string; label: string; fullLabel: string }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(targetWeekStart, i);
        days.push({
          dateStr: format(d, "yyyy-MM-dd"),
          label: format(d, "EEE"), // Sat, Sun, Mon, Tue, Wed, Thu, Fri
          fullLabel: format(d, "EEE, d MMM"),
        });
      }
      return {
        dateRangeList: days,
        fromDateStr: days[0].dateStr,
        toDateStr: days[days.length - 1].dateStr,
      };
    } else {
      // Calendar month starting from Day 1 of the month
      const targetMonthDate = subMonths(today, offset);
      const monthStart = startOfMonth(targetMonthDate);
      const totalDays = getDaysInMonth(monthStart);

      const days: { dateStr: string; label: string; fullLabel: string }[] = [];
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(monthStart, i);
        days.push({
          dateStr: format(d, "yyyy-MM-dd"),
          label: format(d, "d"), // Day 1, 2, 3...
          fullLabel: format(d, "EEE, d MMM"),
        });
      }
      return {
        dateRangeList: days,
        fromDateStr: days[0].dateStr,
        toDateStr: days[days.length - 1].dateStr,
      };
    }
  }, [viewMode, offset, todayStr]);

  // Fetch logs for current range
  const fetchLogsForRange = useCallback(async () => {
    try {
      const res = await fetch(`/api/habits/log?from=${fromDateStr}&to=${toDateStr}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        const newMap: Record<string, string[]> = {};
        data.logs.forEach((item: any) => {
          newMap[item.dateString] = item.completedHabitIds || [];
        });
        setLogsMap((prev) => ({ ...prev, ...newMap }));
      }
    } catch (err) {
      console.error("Failed to load habit logs:", err);
    }
  }, [fromDateStr, toDateStr]);

  useEffect(() => {
    fetchLogsForRange();
  }, [fetchLogsForRange]);

  // Handle toggling habit completion today
  const handleToggleHabit = async (habitId: string) => {
    const isCurrentlyChecked = completedIds.has(habitId);
    const nextCompleted = new Set(completedIds);
    if (isCurrentlyChecked) {
      nextCompleted.delete(habitId);
    } else {
      nextCompleted.add(habitId);
    }

    // Optimistic UI update
    setCompletedIds(nextCompleted);
    setLogsMap((prev) => ({
      ...prev,
      [todayStr]: Array.from(nextCompleted),
    }));

    try {
      const res = await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId,
          dateString: todayStr,
          action: isCurrentlyChecked ? "uncheck" : "check",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback on failure
        setCompletedIds(completedIds);
        setLogsMap((prev) => ({
          ...prev,
          [todayStr]: Array.from(completedIds),
        }));
      } else if (Array.isArray(data.completedHabitIds)) {
        const confirmed = data.completedHabitIds.map(String);
        setCompletedIds(new Set(confirmed));
        setLogsMap((prev) => ({
          ...prev,
          [todayStr]: confirmed,
        }));
        router.refresh();
      }
    } catch {
      setCompletedIds(completedIds);
      setLogsMap((prev) => ({
        ...prev,
        [todayStr]: Array.from(completedIds),
      }));
    }
  };

  // Handle updating habit
  const handleUpdateHabit = (updated: IHabitData) => {
    setHabits((prev) => prev.map((h) => (h._id === updated._id ? updated : h)));
    router.refresh();
  };

  // Handle local state cleanup after habit deletion
  const handleHabitDeleted = (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h._id !== habitId));
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(habitId);
      return next;
    });
    setLogsMap((prev) => {
      const updated: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        updated[k] = v.filter((id) => id !== habitId);
      }
      return updated;
    });
    router.refresh();
  };

  // Handle deleting habit from card button
  const handleDeleteHabit = async (habitId: string) => {
    try {
      const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        handleHabitDeleted(habitId);
      }
    } catch (err) {
      console.error("Failed to delete habit:", err);
    }
  };

  // Build chart history points
  const chartData: IHabitHistoryPoint[] = dateRangeList.map((item) => {
    const completedList = logsMap[item.dateStr] || [];
    // Count only completed that correspond to existing active habits
    const validCount = completedList.length;
    return {
      dateString: item.dateStr,
      dayLabel: item.label,
      fullDateLabel: item.fullLabel,
      completedCount: validCount,
      totalHabits: habits.length,
    };
  });

  const completedTodayCount = completedIds.size;
  const totalHabitsCount = habits.length;
  const progressPct =
    totalHabitsCount > 0 ? Math.round((completedTodayCount / totalHabitsCount) * 100) : 0;

  return (
    <div className="space-y-6 2xl:space-y-8 w-full max-w-[1800px] mx-auto pb-12 select-none">
      {/* Top Banner & Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-linear-to-r from-emerald-500/15 via-teal-500/10 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-950/20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-emerald-500/20">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Daily Rituals
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {completedTodayCount} / {totalHabitsCount} Completed
              </span>
            </div>
            <h2 className="font-extrabold text-lg sm:text-xl text-white mt-0.5">
              Daily Life Habits
            </h2>
          </div>
        </div>

        {/* Action Button: Add Habit */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition shadow-lg shadow-emerald-500/25 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Habit</span>
        </button>
      </div>

      {/* Habits Checklist Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-zinc-100">Today's Habits</h3>
            {totalHabitsCount > 0 && (
              <span className="text-xs font-semibold text-zinc-400">
                ({progressPct}% done)
              </span>
            )}
          </div>
          {totalHabitsCount > 0 && (
            <div className="w-28 sm:w-40 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {habits.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900/40 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-3">
              <Sparkles className="w-7 h-7 text-emerald-400" />
            </div>
            <h4 className="font-extrabold text-base text-white">No habits added yet</h4>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              Start small by adding daily routines like drinking water, reading, or stretching.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Habit</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {habits.map((habit) => (
              <HabitCard
                key={habit._id}
                habit={habit}
                isChecked={completedIds.has(habit._id)}
                onToggle={handleToggleHabit}
                onEdit={(h) => setEditingHabit(h)}
                onDelete={handleDeleteHabit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Comprehensive Habit Trends Chart */}
      <HabitWaveChart
        data={chartData}
        viewMode={viewMode}
        offset={offset}
        onViewModeChange={(m) => {
          setViewMode(m);
          setOffset(0);
        }}
        onOffsetChange={(o) => setOffset(o)}
        title="Habit Consistency Trends"
      />

      {/* Add Habit Modal */}
      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newHabit) => {
          setHabits((prev) => [...prev, newHabit]);
          router.refresh();
        }}
      />

      {/* Edit Habit Modal */}
      <EditHabitModal
        isOpen={!!editingHabit}
        habit={editingHabit}
        onClose={() => setEditingHabit(null)}
        onUpdated={handleUpdateHabit}
        onDeleted={handleHabitDeleted}
      />
    </div>
  );
}
