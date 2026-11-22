"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ListChecks, Loader2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DateStepper } from "@/components/ui/DateStepper";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { PlanTabs } from "@/components/planner/PlanTabs";
import { ConsistencyChart } from "./ConsistencyChart";
import { HabitRow, type HabitStripDay } from "./HabitRow";
import { HabitSheet } from "./HabitSheet";
import { useLiveToday } from "./useLiveToday";
import { useHabitLogs, type LogsMap } from "./useHabitLogs";
import { useHabitArchive } from "./useHabitArchive";
import { errorMessage, requestJson, type HabitLogsResponse } from "./api";
import type { HabitDTO } from "@/lib/habits/dto";
import { buildHabitHistory, completionForDay, isHabitActiveOn, summarizeCompletion } from "@/lib/habits/completion";
import { addDays, formatDateString, type WeekdayKey } from "@/lib/time";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { markDashboardStale } from "@/lib/dashboard/stale";
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
const CHART_DAYS = 14;
const STRIP_DAYS = 7;

/** Every day from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Plan › Habits: the day's checklist, 14-day consistency, archived habits. */
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
  const [sheet, setSheet] = useState<{ habit: HabitDTO | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { logsMap, toggle, isPending, mergeServerLogs, snapshotSeq } = useHabitLogs({ [todayStr]: initialCompletedHabitIds });

  const liveToday = useLiveToday(todayStr, timeZone, {
    onDayChange: (now, previous) => setSelectedDateStr((current) => (current === previous ? now : current)),
  });

  // Logs for the chart (14 days to today) and the strips (7 days to the selected day).
  const from = useMemo(() => {
    const chartStart = addDays(liveToday, -(CHART_DAYS - 1));
    const stripStart = addDays(selectedDateStr, -(STRIP_DAYS - 1));
    return stripStart < chartStart ? stripStart : chartStart;
  }, [liveToday, selectedDateStr]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const rangeKey = `${from}:${liveToday}:${reloadNonce}`;
  const [rangeStatus, setRangeStatus] = useState<{ key: string; error: string | null }>({ key: "", error: null });
  const rangeLoading = rangeStatus.key !== rangeKey;
  const rangeError = rangeStatus.key === rangeKey ? rangeStatus.error : null;

  useEffect(() => {
    // A flag, not an AbortController: aborting surfaces as an unhandled error in the browser.
    let stale = false;
    const startedAt = snapshotSeq();
    requestJson<HabitLogsResponse>(`/api/habits/log?from=${from}&to=${liveToday}`)
      .then((data) => {
        if (stale) return;
        const entries: LogsMap = {};
        for (const day of daysBetween(from, liveToday)) entries[day] = [];
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
  }, [rangeKey, from, liveToday, mergeServerLogs, snapshotSeq]);

  const selectDate = useCallback(
    (dateStr: string) => {
      if (dateStr > getTodayDateString(new Date(), timeZone)) return;
      setSelectedDateStr(dateStr);
    },
    [timeZone]
  );

  const handleToggle = async (habitId: string, checked: boolean) => {
    const dateString = selectedDateStr;
    if (dateString > getTodayDateString(new Date(), timeZone)) {
      toast("You can't log a habit for a future day.", "error");
      return;
    }
    const saved = await toggle(habitId, dateString, checked);
    if (saved) markDashboardStale();
  };

  const archiveFlow = useHabitArchive({
    onArchived: (habit) => {
      setHabits((prev) => prev.filter((h) => h._id !== habit._id));
      setArchived((prev) => [habit, ...prev.filter((h) => h._id !== habit._id)]);
      setSheet(null);
    },
    onRestored: (habit) => {
      setArchived((prev) => prev.filter((h) => h._id !== habit._id));
      setHabits((prev) => [...prev.filter((h) => h._id !== habit._id), habit]);
    },
  });

  const allHabits = useMemo(() => [...habits, ...archived], [habits, archived]);
  const chartDays = useMemo(() => daysBetween(addDays(liveToday, -(CHART_DAYS - 1)), liveToday), [liveToday]);
  const chartPoints = useMemo(
    () => buildHabitHistory({ habits: allHabits, logsByDate: logsMap, dates: chartDays, todayDateString: liveToday }),
    [allHabits, logsMap, chartDays, liveToday]
  );
  const consistency = summarizeCompletion(chartPoints).percent;
  const stripDays = useMemo(() => daysBetween(addDays(selectedDateStr, -(STRIP_DAYS - 1)), selectedDateStr), [selectedDateStr]);

  const isToday = selectedDateStr === liveToday;
  const dayLoaded = logsMap[selectedDateStr] !== undefined;
  const selectedStats = completionForDay(habits, logsMap[selectedDateStr], selectedDateStr);
  const selectedCompleted = new Set(selectedStats.completedIds);
  const dayTitle = isToday
    ? "Today"
    : selectedDateStr === addDays(liveToday, -1)
      ? "Yesterday"
      : formatDateString(selectedDateStr, { weekday: "long", month: "short", day: "numeric" });
  // Days with any habit done get a dot in the calendar.
  const doneDates = useMemo(
    () => Object.entries(logsMap).filter(([, ids]) => ids.length > 0).map(([date]) => date),
    [logsMap]
  );

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
      <div className="lg:col-span-2">
        <PlanTabs active="habits" className="w-full md:max-w-[300px]" />
      </div>

      <div className="space-y-3">
        <DateStepper
          value={selectedDateStr}
          today={liveToday}
          onChange={selectDate}
          weekStartsOn={CALENDAR_WEEK_START[weekStartDay] ?? 6}
          indicatorDates={doneDates}
          indicatorLabel="Days with habits done"
          label="Choose a day to log"
        />

        <div className="flex items-center justify-between gap-3 px-0.5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{dayTitle}</h2>
            <p className="text-xs text-ink-3" aria-live="polite">
              {selectedStats.total > 0 ? (
                <>
                  <span className="font-mono tabular-nums">
                    {selectedStats.completed} of {selectedStats.total}
                  </span>{" "}
                  habits done
                </>
              ) : (
                "No habits for this day"
              )}
            </p>
          </div>
          <Button size="sm" startContent={<Plus className="h-3.5 w-3.5" />} onClick={() => setSheet({ habit: null })}>
            New habit
          </Button>
        </div>

        {habits.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="No habits yet"
            description="Start small: a glass of water on waking, ten minutes of reading, a short walk."
            actions={
              <Button variant="secondary" startContent={<Plus className="h-4 w-4" />} onClick={() => setSheet({ habit: null })}>
                Create your first habit
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" aria-busy={!dayLoaded || undefined}>
            {habits.map((habit) => {
              const checked = selectedCompleted.has(habit._id);
              const notYet = Boolean(habit.createdDate) && selectedDateStr < habit.createdDate && !checked;
              const strip: HabitStripDay[] = stripDays.map((day) => ({
                dateString: day,
                done: (logsMap[day] ?? []).includes(habit._id),
                isSelected: day === selectedDateStr,
                inactive: !isHabitActiveOn(habit, day),
              }));
              return (
                <HabitRow
                  key={habit._id}
                  habit={habit}
                  isChecked={checked}
                  isPending={isPending(selectedDateStr, habit._id)}
                  disabledReason={!dayLoaded ? "Loading" : notYet ? "Added after this day" : null}
                  strip={strip}
                  onToggle={handleToggle}
                  onEdit={(h) => setSheet({ habit: h })}
                />
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <ConsistencyChart
          points={chartPoints}
          percent={consistency}
          loading={rangeLoading}
          error={rangeError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          onSelectDate={selectDate}
          selectedDate={selectedDateStr}
        />

        {archived.length > 0 && (
          <section aria-label="Archived habits" className="overflow-hidden rounded-card border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowArchived((open) => !open)}
              aria-expanded={showArchived}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-start text-sm text-ink-2 transition-colors hover:bg-elevated/60 cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archived habits
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-xs tabular-nums text-ink-3">{archived.length}</span>
                <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${showArchived ? "rotate-180" : ""}`} aria-hidden="true" />
              </span>
            </button>
            {showArchived && (
              <ul className="divide-y divide-line border-t border-line">
                {archived.map((habit) => (
                  <li key={habit._id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="h-7 w-[3px] shrink-0 rounded-full opacity-60" style={{ backgroundColor: safeHabitColor(habit.color) }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink-2">
                          <span aria-hidden="true">{habit.emoji} </span>
                          {habit.name}
                        </span>
                        {habit.archivedDate && (
                          <span className="block text-xs text-ink-3">
                            Archived {formatDateString(habit.archivedDate, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={archiveFlow.restoringId !== null}
                      onClick={() => void archiveFlow.restore(habit)}
                      aria-label={`Restore ${habit.name}`}
                      startContent={
                        archiveFlow.restoringId === habit._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <HabitSheet
        isOpen={Boolean(sheet)}
        habit={sheet?.habit ?? null}
        onClose={() => setSheet(null)}
        onSaved={(saved) =>
          setHabits((prev) => (prev.some((h) => h._id === saved._id) ? prev.map((h) => (h._id === saved._id ? saved : h)) : [...prev, saved]))
        }
        onArchive={(habit) => void archiveFlow.archive(habit)}
      />
    </div>
  );
}

export default HabitsPage;
