"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Sparkles } from "lucide-react";
import { HabitCard } from "./HabitCard";
import { HabitFormModal } from "./HabitFormModal";
import { HabitsCalendarPopover } from "./HabitsCalendarPopover";
import { HabitWaveChart, type HabitChartPoint } from "./HabitWaveChart";
import { useLiveToday } from "./useLiveToday";
import { useHabitLogs, type LogsMap } from "./useHabitLogs";
import { useHabitArchive } from "./useHabitArchive";
import { errorMessage, requestJson, type HabitLogsResponse } from "./api";
import type { HabitDTO } from "@/lib/habits/dto";
import { buildHabitHistory, completionForDay } from "@/lib/habits/completion";
import { habitDateRange, offsetForDate, type HabitViewMode } from "@/lib/habits/range";
import { addDays, formatDateString, type WeekdayKey } from "@/lib/time";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { useToast } from "@/components/ui/Toast";
import { safeHabitColor } from "@/lib/habits/colors";

interface HabitsPageProps {
  initialHabits: HabitDTO[];
  initialArchivedHabits: HabitDTO[];
  initialCompletedHabitIds: string[];
  todayStr: string;
  timeZone: string;
  weekStartDay: WeekdayKey;
}

const CALENDAR_WEEK_START: Partial<Record<WeekdayKey, 0 | 1 | 6>> = { sunday: 0, monday: 1, saturday: 6 };

export function HabitsPage({
  initialHabits,
  initialArchivedHabits,
  initialCompletedHabitIds,
  todayStr,
  timeZone,
  weekStartDay,
}: HabitsPageProps) {
  const { toast } = useToast();
  const [habits, setHabits] = useState<HabitDTO[]>(initialHabits);
  const [archived, setArchived] = useState<HabitDTO[]>(initialArchivedHabits);
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
  const [viewMode, setViewMode] = useState<HabitViewMode>("week");
  const [offset, setOffset] = useState(0);
  const [formHabit, setFormHabit] = useState<HabitDTO | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const calendarTriggerRef = useRef<HTMLButtonElement>(null);

  const { logsMap, toggle, isPending, mergeServerLogs, snapshotSeq } = useHabitLogs({
    [todayStr]: initialCompletedHabitIds,
  });

  const liveToday = useLiveToday(todayStr, timeZone, {
    onDayChange: (now, previous) => {
      setSelectedDateStr((current) => (current === previous ? now : current));
    },
  });

  const range = useMemo(
    () => habitDateRange({ todayDateString: liveToday, viewMode, offset, weekStart: weekStartDay }),
    [liveToday, viewMode, offset, weekStartDay]
  );

  // ---- range loading (with loading / error state, stale responses ignored) ----
  const [reloadNonce, setReloadNonce] = useState(0);
  const rangeKey = `${range.from}:${range.to}:${reloadNonce}`;
  const [rangeStatus, setRangeStatus] = useState<{ key: string; error: string | null }>({ key: "", error: null });
  const rangeLoading = rangeStatus.key !== rangeKey;
  const rangeError = rangeStatus.key === rangeKey ? rangeStatus.error : null;

  useEffect(() => {
    // A flag, not an AbortController: aborting an in-flight request surfaces as an
    // unhandled "signal is aborted without reason" error in the browser.
    let stale = false;
    const startedAt = snapshotSeq();
    const { from, to } = range;
    requestJson<HabitLogsResponse>(`/api/habits/log?from=${from}&to=${to}`)
      .then((data) => {
        if (stale) return;
        const entries: LogsMap = {};
        for (const day of range.days) entries[day.dateString] = [];
        for (const log of data.logs) entries[log.dateString] = log.completedHabitIds;
        mergeServerLogs(entries, startedAt);
        setRangeStatus({ key: rangeKey, error: null });
      })
      .catch((err: unknown) => {
        if (stale) return;
        setRangeStatus({ key: rangeKey, error: errorMessage(err, "Could not load habit history.") });
      });
    return () => {
      stale = true;
    };
  }, [rangeKey, range, mergeServerLogs, snapshotSeq]);

  // ---- date selection ----
  const isToday = selectedDateStr === liveToday;
  const selectedLabel = isToday
    ? "Today"
    : selectedDateStr === addDays(liveToday, -1)
      ? "Yesterday"
      : formatDateString(selectedDateStr, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const handleSelectDate = useCallback(
    (dateStr: string) => {
      const today = getTodayDateString(new Date(), timeZone);
      if (dateStr > today) return;
      setSelectedDateStr(dateStr);
      setOffset(offsetForDate({ todayDateString: today, dateString: dateStr, viewMode, weekStart: weekStartDay }));
    },
    [timeZone, viewMode, weekStartDay]
  );

  // ---- toggling ----
  const handleToggle = async (habitId: string, checked: boolean) => {
    const dateString = selectedDateStr;
    if (dateString > getTodayDateString(new Date(), timeZone)) {
      toast("You can't log a habit for a future day.", "error");
      return;
    }
    const saved = await toggle(habitId, dateString, checked);
    if (saved) markDashboardStale();
  };

  // ---- archive / restore ----
  const archiveFlow = useHabitArchive({
    onArchived: (habit) => {
      setHabits((prev) => prev.filter((h) => h._id !== habit._id));
      setArchived((prev) => [habit, ...prev.filter((h) => h._id !== habit._id)]);
      setIsFormOpen(false);
      setFormHabit(null);
    },
    onRestored: (habit) => {
      setArchived((prev) => prev.filter((h) => h._id !== habit._id));
      setHabits((prev) => [...prev.filter((h) => h._id !== habit._id), habit]);
    },
  });

  // ---- derived numbers ----
  const allHabits = useMemo(() => [...habits, ...archived], [habits, archived]);

  const chartData: HabitChartPoint[] = useMemo(() => {
    const points = buildHabitHistory({
      habits: allHabits,
      logsByDate: logsMap,
      dates: range.days.map((d) => d.dateString),
      todayDateString: liveToday,
    });
    return points.map((point, i) => ({ ...point, dayLabel: range.days[i].label, fullDateLabel: range.days[i].fullLabel }));
  }, [allHabits, logsMap, range, liveToday]);

  const todayStats = completionForDay(habits, logsMap[liveToday], liveToday);
  const dayLoaded = logsMap[selectedDateStr] !== undefined;
  const selectedStats = completionForDay(habits, logsMap[selectedDateStr], selectedDateStr);
  const selectedCompleted = new Set(selectedStats.completedIds);
  const progressPct = selectedStats.total > 0 ? Math.round((selectedStats.completed / selectedStats.total) * 100) : 0;

  const openCreate = () => {
    setFormHabit(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6 2xl:space-y-8 w-full max-w-[1800px] mx-auto pb-12">
      <div className="p-4 sm:p-6 rounded-3xl bg-linear-to-r from-emerald-500/15 via-teal-500/10 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center shrink-0" aria-hidden="true">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Daily Rituals</span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Today: {todayStats.completed} / {todayStats.total} completed
              </span>
            </div>
            <h1 className="font-extrabold text-lg sm:text-xl text-white mt-0.5">Daily Life Habits</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-11 flex items-center justify-center gap-2 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black transition active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add new habit</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-3xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectDate(addDays(selectedDateStr, -1))}
              aria-label="Previous day"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/60"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              ref={calendarTriggerRef}
              type="button"
              onClick={() => setShowCalendar((prev) => !prev)}
              className="min-h-11 flex items-center gap-2 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-bold transition cursor-pointer"
              aria-label={`Selected day: ${selectedLabel}. Open calendar`}
              aria-expanded={showCalendar}
            >
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{selectedLabel}</span>
            </button>
            <HabitsCalendarPopover
              isOpen={showCalendar}
              onClose={() => setShowCalendar(false)}
              triggerRef={calendarTriggerRef}
              selectedDateStr={selectedDateStr}
              todayStr={liveToday}
              onSelectDate={handleSelectDate}
              logsMap={logsMap}
              weekStartsOn={CALENDAR_WEEK_START[weekStartDay] ?? 6}
            />
            <button
              type="button"
              onClick={() => handleSelectDate(addDays(selectedDateStr, 1))}
              disabled={isToday}
              aria-label="Next day"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/60"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => handleSelectDate(liveToday)}
                className="min-h-11 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-sm font-bold transition cursor-pointer"
              >
                Jump to today
              </button>
            )}
          </div>

          {selectedStats.total > 0 && (
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-sm font-semibold text-zinc-400">
                <strong className="text-white">{selectedStats.completed}</strong> of {selectedStats.total} done ({progressPct}%)
              </span>
              <div
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${selectedLabel}: habits completed`}
                className="w-24 sm:w-32 h-2 rounded-full bg-zinc-800 overflow-hidden"
              >
                <div className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {habits.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900/40 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center mb-3" aria-hidden="true">
              <Sparkles className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="font-extrabold text-base text-white">No habits yet</h2>
            <p className="text-sm text-zinc-400 max-w-sm mt-1">
              Start small with daily routines like drinking water, reading, or stretching.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 min-h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-sm font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Create first habit</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4" aria-busy={!dayLoaded}>
            {habits.map((habit) => {
              const checked = selectedCompleted.has(habit._id);
              const notYet = Boolean(habit.createdDate) && selectedDateStr < habit.createdDate && !checked;
              return (
                <HabitCard
                  key={habit._id}
                  habit={habit}
                  isChecked={checked}
                  isPending={isPending(selectedDateStr, habit._id)}
                  disabledReason={!dayLoaded ? "Loading…" : notYet ? "Added after this day" : null}
                  onToggle={handleToggle}
                  onEdit={(h) => {
                    setFormHabit(h);
                    setIsFormOpen(true);
                  }}
                  onArchive={archiveFlow.requestArchive}
                />
              );
            })}
          </div>
        )}
      </div>

      <HabitWaveChart
        data={chartData}
        viewMode={viewMode}
        offset={offset}
        periodLabel={range.periodLabel}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setOffset(0);
        }}
        onOffsetChange={setOffset}
        selectedDate={selectedDateStr}
        onSelectDate={handleSelectDate}
        loading={rangeLoading}
        error={rangeError}
        onRetry={() => setReloadNonce((n) => n + 1)}
      />

      {archived.length > 0 && (
        <section className="rounded-3xl bg-zinc-900/40 border border-zinc-800" aria-label="Archived habits">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            aria-expanded={showArchived}
            className="w-full min-h-11 flex items-center justify-between gap-3 p-4 text-start cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-zinc-200">
              <Archive className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              Archived habits ({archived.length})
            </span>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showArchived ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showArchived && (
            <ul className="px-4 pb-4 space-y-2">
              {archived.map((habit) => (
                <li key={habit._id} className="flex items-center justify-between gap-3 p-2 ps-3 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                  <span className="flex items-center gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${safeHabitColor(habit.color)}18` }}
                    >
                      {habit.emoji}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-zinc-200 truncate">{habit.name}</span>
                      {habit.archivedDate && (
                        <span className="block text-xs text-zinc-400">
                          Archived {formatDateString(habit.archivedDate, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => archiveFlow.restore(habit)}
                    disabled={archiveFlow.restoringId !== null}
                    aria-label={`Restore ${habit.name}`}
                    className="min-h-11 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-sm font-bold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {archiveFlow.restoringId === habit._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>Restore</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HabitFormModal
        isOpen={isFormOpen}
        habit={formHabit}
        onClose={() => setIsFormOpen(false)}
        onSaved={(saved) => {
          setHabits((prev) =>
            prev.some((h) => h._id === saved._id) ? prev.map((h) => (h._id === saved._id ? saved : h)) : [...prev, saved]
          );
        }}
        onRequestArchive={(h) => {
          setIsFormOpen(false);
          archiveFlow.requestArchive(h);
        }}
      />

      {archiveFlow.element}
    </div>
  );
}
