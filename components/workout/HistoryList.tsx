"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUser } from "@/context/UserContext";
import { api, errorMessage } from "@/lib/client/api";
import { formatVolume } from "@/lib/fitness/units";
import { formatDateString } from "@/lib/time";
import { formatDurationShort } from "@/lib/workouts/calc";
import { muscleGroupSummary, pluralize } from "@/lib/workouts/format";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

interface HistoryListProps {
  initialSessions: SessionSummaryDTO[];
  initialCursor: string | null;
}

/** Every finished workout, newest first, grouped by month. */
export function HistoryList({ initialSessions, initialCursor }: HistoryListProps) {
  const { weightUnit } = useUser();
  const [sessions, setSessions] = useState(initialSessions);
  const [cursor, setCursor] = useState(initialCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: SessionSummaryDTO[] }> = [];
    for (const session of sessions) {
      const key = session.localDate.slice(0, 7);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: formatDateString(session.localDate, { month: "long", year: "numeric" }), items: [] };
        groups.push(group);
      }
      group.items.push(session);
    }
    return groups;
  }, [sessions]);

  const loadMore = async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api<{ sessions: SessionSummaryDTO[]; nextCursor: string | null }>(
        `/api/sessions?limit=20&cursor=${encodeURIComponent(cursor)}`
      );
      setSessions((current) => {
        const known = new Set(current.map((session) => session.id));
        return [...current, ...data.sessions.filter((session) => !known.has(session.id))];
      });
      setCursor(data.nextCursor);
    } catch (err) {
      setError(errorMessage(err, "More workouts could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-2">
        <Link
          href="/workouts"
          aria-label="Back to Train"
          className="grid h-11 w-11 -ms-2 place-items-center rounded-full text-zinc-300 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Workout history</h1>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-4 py-12 text-center">
          <p className="text-base font-semibold text-white">No workouts yet</p>
          <p className="mt-1 text-sm text-zinc-400">Every workout you finish is kept here.</p>
          <Link
            href="/workouts"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-500 px-5 text-sm font-bold text-zinc-950"
          >
            Go to Train
          </Link>
        </div>
      ) : (
        months.map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`} className="space-y-2">
            <h2 id={`month-${month.key}`} className="flex items-baseline justify-between px-1">
              <span className="text-base font-semibold text-white">{month.label}</span>
              <span className="text-sm text-zinc-400">{pluralize(month.items.length, "workout")}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              {month.items.map((session) => {
                const groups = muscleGroupSummary(session.muscleGroups);
                return (
                  <li key={session.id}>
                    <Link
                      href={`/workouts/history/${session.id}`}
                      className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-white/5"
                    >
                      <span className="w-12 shrink-0 text-center">
                        <span className="block text-xs text-zinc-400">
                          {formatDateString(session.localDate, { weekday: "short" })}
                        </span>
                        <span className="block text-xl font-bold text-white tabular-nums">
                          {Number(session.localDate.slice(8, 10))}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-white">{session.name}</span>
                        <span className="block truncate text-sm text-zinc-400">
                          {formatDurationShort(session.durationSec)} · {pluralize(session.totals.completedSets, "set")}
                          {session.totals.volumeKg > 0 ? ` · ${formatVolume(session.totals.volumeKg, weightUnit)}` : ""}
                        </span>
                        {groups && <span className="block truncate text-sm text-zinc-400">{groups}</span>}
                      </span>
                      {session.totals.prCount > 0 && (
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-300">
                          <Trophy className="h-4 w-4" aria-hidden="true" />
                          {session.totals.prCount}
                          <span className="sr-only">personal records</span>
                        </span>
                      )}
                      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {cursor && (
        <Button variant="bordered" className="w-full" isLoading={isLoading} onClick={() => void loadMore()}>
          Show older workouts
        </Button>
      )}
    </div>
  );
}

export default HistoryList;
