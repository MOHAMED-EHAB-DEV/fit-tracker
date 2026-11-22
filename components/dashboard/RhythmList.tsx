"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tick } from "@/components/ui/Tick";
import { buttonClasses } from "@/components/ui/button-styles";
import { useHabitLogs } from "@/components/habits/useHabitLogs";
import { useLiveToday } from "@/components/habits/useLiveToday";
import { useToast } from "@/components/ui/Toast";
import { completionForDay } from "@/lib/habits/completion";
import { DEFAULT_HABIT_EMOJI, safeHabitColor } from "@/lib/habits/colors";
import { claimRefresh } from "@/lib/dashboard/stale";
import { getTodayDateString } from "@/lib/fitness/timezone";
import type { HabitDTO } from "@/lib/habits/dto";

export interface NextEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  color: string;
}

export interface RhythmListProps {
  /** The next one or two planner events today that have not ended. */
  events: NextEvent[];
  habits: HabitDTO[];
  initialCompletedHabitIds: string[];
  todayStr: string;
  timeZone: string;
}

const MAX_HABITS = 6;

function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function durationLabel(start: string, end?: string | null): string | null {
  const from = minutesOf(start);
  const to = end ? minutesOf(end) : null;
  if (from === null || to === null || to <= from) return null;
  const minutes = to - from;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/**
 * Up next and habits: the next planner events (tap to open the planner) and
 * today's habits, ticked off right here.
 */
export function RhythmList({ events, habits, initialCompletedHabitIds, todayStr, timeZone }: RhythmListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const liveToday = useLiveToday(todayStr, timeZone);
  const dayIsStale = liveToday !== todayStr;

  const { logsMap, toggle, isPending, hasPending, setDay } = useHabitLogs({ [todayStr]: initialCompletedHabitIds });
  const [seen, setSeen] = useState({ todayStr, ids: initialCompletedHabitIds });
  if (seen.ids !== initialCompletedHabitIds || seen.todayStr !== todayStr) {
    setSeen({ todayStr, ids: initialCompletedHabitIds });
    setDay(todayStr, initialCompletedHabitIds);
  }

  // Refresh the server-rendered parts (streak) once toggles settle.
  const [needsRefresh, setNeedsRefresh] = useState(false);
  useEffect(() => {
    if (!needsRefresh || hasPending) return;
    const timer = window.setTimeout(() => {
      setNeedsRefresh(false);
      router.refresh();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [needsRefresh, hasPending, router]);

  const onToggle = async (habitId: string, checked: boolean) => {
    if (getTodayDateString(new Date(), timeZone) !== todayStr) {
      toast("A new day has started. Updating Today…", "info");
      if (claimRefresh()) router.refresh();
      return;
    }
    if (await toggle(habitId, todayStr, checked)) setNeedsRefresh(true);
  };

  const today = completionForDay(habits, logsMap[todayStr], todayStr);
  const done = new Set(today.completedIds);
  const shownHabits = habits.slice(0, MAX_HABITS);
  const left = events.length + (today.total - today.completed);
  const total = events.length + today.total;

  if (events.length === 0 && habits.length === 0) {
    return (
      <section aria-labelledby="rhythm-title" className="space-y-2">
        <SectionHeader id="rhythm-title" title="Up next and habits" />
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-4">
          <p className="text-sm text-ink-2">Nothing else planned today, and no daily habits yet.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/planner" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Plan your day
            </Link>
            <Link href="/habits" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Add a habit
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="rhythm-title" className="space-y-2">
      <SectionHeader id="rhythm-title" title="Up next and habits" meta={total > 0 ? `${left} of ${total} left` : undefined} />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {events.map((event) => {
          const duration = durationLabel(event.startTime, event.endTime);
          return (
            <li key={event.id}>
              <Link
                href="/planner"
                className="flex min-h-[46px] items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-elevated/60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-[22px] w-[3px] shrink-0 rounded-[2px]"
                    style={{ backgroundColor: safeHabitColor(event.color) }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{event.title}</span>
                    <span className="block font-mono text-xs tabular-nums text-ink-3">
                      {event.startTime}
                      {duration ? ` · ${duration}` : ""}
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
        {shownHabits.map((habit) => {
          const checked = done.has(habit._id);
          return (
            <li key={habit._id} className="flex min-h-[46px] items-center justify-between gap-3 px-3.5 py-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-[22px] w-[3px] shrink-0 rounded-[2px]"
                  style={{ backgroundColor: safeHabitColor(habit.color) }}
                />
                <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                  {habit.emoji || DEFAULT_HABIT_EMOJI}
                </span>
                <span className={checked ? "truncate text-sm font-medium text-ink-2" : "truncate text-sm font-medium text-ink"}>
                  {habit.name}
                </span>
              </span>
              <Tick
                size="sm"
                checked={checked}
                disabled={dayIsStale || isPending(todayStr, habit._id)}
                onChange={(next) => void onToggle(habit._id, next)}
                label={`${habit.name} done today`}
              />
            </li>
          );
        })}
      </ul>
      {habits.length > MAX_HABITS && (
        <Link href="/habits" className="inline-flex min-h-11 items-center px-0.5 text-xs font-medium text-ink-3 hover:text-ink">
          {habits.length - MAX_HABITS} more habits in Plan
        </Link>
      )}
    </section>
  );
}

export default RhythmList;
