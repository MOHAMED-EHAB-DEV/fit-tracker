"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
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

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Dumbbell className="h-5 w-5" />}
        title="No workouts yet"
        description="Every workout you finish is kept here, with its sets and records."
        actions={
          <Link href="/workouts" className={buttonClasses({ variant: "secondary" })}>
            Go to Workouts
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {months.map((month) => (
        <section key={month.key} aria-labelledby={`month-${month.key}`} className="space-y-2">
          <SectionHeader id={`month-${month.key}`} title={month.label} meta={pluralize(month.items.length, "workout")} />
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {month.items.map((session) => {
              const groups = muscleGroupSummary(session.muscleGroups);
              const details = [
                formatDurationShort(session.durationSec),
                pluralize(session.totals.completedSets, "set"),
                session.totals.volumeKg > 0 ? formatVolume(session.totals.volumeKg, weightUnit) : null,
              ].filter(Boolean);
              return (
                <li key={session.id}>
                  <Link
                    href={`/workouts/history/${session.id}`}
                    className="flex min-h-16 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-elevated/60 active:bg-elevated"
                  >
                    <span className="w-9 shrink-0 text-center" aria-hidden="true">
                      <span className="block text-xs text-ink-3">{formatDateString(session.localDate, { weekday: "short" })}</span>
                      <span className="block font-mono text-[17px] font-semibold leading-6 tabular-nums text-ink">
                        {Number(session.localDate.slice(8, 10))}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sr-only">{formatDateString(session.localDate, { weekday: "long", month: "long", day: "numeric" })}: </span>
                      <span className="block truncate text-sm font-medium text-ink">{session.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        {details.join(" · ")}
                        {groups ? ` · ${groups}` : ""}
                      </span>
                    </span>
                    {session.totals.prCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[13px] font-semibold tabular-nums text-warn">
                        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                        {session.totals.prCount}
                        <span className="sr-only">{session.totals.prCount === 1 ? "personal record" : "personal records"}</span>
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {error && (
        <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {cursor && (
        <Button variant="secondary" fullWidth isLoading={isLoading} onClick={() => void loadMore()}>
          Show older workouts
        </Button>
      )}
    </div>
  );
}

export default HistoryList;
