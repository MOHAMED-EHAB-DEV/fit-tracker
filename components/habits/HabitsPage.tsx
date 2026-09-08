"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, CheckSquare, Flame, Loader2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { HabitCard, IHabitData } from "./HabitCard";
import { AddHabitModal } from "./AddHabitModal";
import { EditHabitModal } from "./EditHabitModal";
import { HabitsCalendarPopover } from "./HabitsCalendarPopover";
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
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarTriggerRef = useRef<HTMLButtonElement>(null);
  const [editingHabit, setEditingHabit] = useState<IHabitData | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState<number>(0);
  const [logsMap, setLogsMap] = useState<Record<string, string[]>>({
    [todayStr]: initialCompletedHabitIds,
  });

  useEffect(() => {
    setLogsMap((prev) => ({
      ...prev,
      [todayStr]: initialCompletedHabitIds,
    }));
  }, [initialCompletedHabitIds, todayStr]);

  const selectedDate = useMemo(() => parseISO(selectedDateStr), [selectedDateStr]);
  const isToday = selectedDateStr === todayStr;
  const yesterdayStr = useMemo(
    () => format(subDays(parseISO(todayStr), 1), "yyyy-MM-dd"),
    [todayStr]
  );
  const isYesterday = selectedDateStr === yesterdayStr;

  const selectedDateFormatted = useMemo(() => {
    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return format(selectedDate, "EEE, d MMM yyyy");
  }, [isToday, isYesterday, selectedDate]);

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

  const handleSelectDate = (dateStr: string) => {
    if (dateStr > todayStr) return;
    setSelectedDateStr(dateStr);
    const targetDate = parseISO(dateStr);
    const today = parseISO(todayStr);

    if (viewMode === "week") {
      const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 6 });
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 6 });
      const diffWeeks = Math.round(
        (currentWeekStart.getTime() - targetWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (diffWeeks >= 0 && diffWeeks !== offset) {
        setOffset(diffWeeks);
      }
    } else {
      const diffMonths =
        (today.getFullYear() - targetDate.getFullYear()) * 12 +
        (today.getMonth() - targetDate.getMonth());
      if (diffMonths >= 0 && diffMonths !== offset) {
        setOffset(diffMonths);
      }
    }
  };

  const handlePrevDay = () => {
    const prev = subDays(selectedDate, 1);
    handleSelectDate(format(prev, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    if (isToday) return;
    const next = addDays(selectedDate, 1);
    handleSelectDate(format(next, "yyyy-MM-dd"));
  };

  // Ensure logsMap has data for selectedDateStr if chosen outside current range
  useEffect(() => {
    if (logsMap[selectedDateStr] === undefined) {
      fetch(`/api/habits/log?from=${selectedDateStr}&to=${selectedDateStr}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.logs)) {
            const map: Record<string, string[]> = {};
            data.logs.forEach((item: any) => {
              map[item.dateString] = item.completedHabitIds || [];
            });
            if (!map[selectedDateStr]) map[selectedDateStr] = [];
            setLogsMap((prev) => ({ ...prev, ...map }));
          }
        })
        .catch((err) => console.error("Failed to load date log:", err));
    }
  }, [selectedDateStr, logsMap]);

  const selectedCompletedIds = useMemo(() => {
    return new Set(logsMap[selectedDateStr] || []);
  }, [logsMap, selectedDateStr]);

  // Handle toggling habit completion for selected date
  const handleToggleHabit = async (habitId: string) => {
    const isCurrentlyChecked = selectedCompletedIds.has(habitId);
    const nextCompleted = new Set(selectedCompletedIds);
    if (isCurrentlyChecked) {
      nextCompleted.delete(habitId);
    } else {
      nextCompleted.add(habitId);
    }

    const prevList = logsMap[selectedDateStr] || [];

    // Optimistic UI update
    setLogsMap((prev) => ({
      ...prev,
      [selectedDateStr]: Array.from(nextCompleted),
    }));

    try {
      const res = await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId,
          dateString: selectedDateStr,
          action: isCurrentlyChecked ? "uncheck" : "check",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Rollback on failure
        setLogsMap((prev) => ({
          ...prev,
          [selectedDateStr]: prevList,
        }));
      } else if (Array.isArray(data.completedHabitIds)) {
        const confirmed = data.completedHabitIds.map(String);
        setLogsMap((prev) => ({
          ...prev,
          [selectedDateStr]: confirmed,
        }));
        router.refresh();
      }
    } catch {
      setLogsMap((prev) => ({
        ...prev,
        [selectedDateStr]: prevList,
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

  const completedTodayCount = (logsMap[todayStr] || []).length;
  const completedOnSelectedCount = selectedCompletedIds.size;
  const totalHabitsCount = habits.length;
  const progressPct =
    totalHabitsCount > 0 ? Math.round((completedOnSelectedCount / totalHabitsCount) * 100) : 0;

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

      {/* Habits Checklist Section */}
      <div className="space-y-4">
        {/* Date Selector Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-3xl bg-zinc-900/70 border border-zinc-800 shadow-md">
          {/* Left: Day arrows, Calendar date picker button, Quick jump */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrevDay}
              title="Previous day"
              aria-label="Previous day"
              className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/60"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Interactive Calendar Trigger Button */}
            <button
              ref={calendarTriggerRef}
              type="button"
              onClick={() => setShowCalendar((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-100 text-xs font-bold transition cursor-pointer select-none"
              title="Open calendar to pick a date"
              aria-expanded={showCalendar}
            >
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{selectedDateFormatted}</span>
              {!isToday && (
                <span className="text-[11px] font-mono text-zinc-400 font-normal">
                  ({selectedDateStr})
                </span>
              )}
            </button>

            {/* Portaled Habits Calendar Popover */}
            <HabitsCalendarPopover
              isOpen={showCalendar}
              onClose={() => setShowCalendar(false)}
              triggerRef={calendarTriggerRef}
              selectedDateStr={selectedDateStr}
              todayStr={todayStr}
              onSelectDate={handleSelectDate}
              logsMap={logsMap}
            />

            <button
              type="button"
              onClick={handleNextDay}
              disabled={isToday}
              title="Next day"
              aria-label="Next day"
              className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/60"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => handleSelectDate(todayStr)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
              >
                Jump to Today
              </button>
            )}
          </div>

          {/* Right: Completion stats & progress bar for selected date */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs font-semibold text-zinc-400">
              <strong className="text-white">{completedOnSelectedCount}</strong> of {totalHabitsCount} done
              {totalHabitsCount > 0 && ` (${progressPct}%)`}
            </span>
            {totalHabitsCount > 0 && (
              <div className="w-24 sm:w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
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
                isChecked={selectedCompletedIds.has(habit._id)}
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
        selectedDate={selectedDateStr}
        onSelectDate={handleSelectDate}
        todayStr={todayStr}
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
