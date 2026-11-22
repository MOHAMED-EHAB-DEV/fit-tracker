"use client";

import React from "react";
import { Flame } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import type { IStreakData } from "@/lib/fitness/streak";

function days(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/** The logging streak in the Today header: flame + days; the popover shows current and best. */
export function StreakChip({ streak }: { streak: IStreakData }) {
  const { currentStreak, longestStreak, consistencyRate30d, isLoggedToday } = streak;

  return (
    <Popover
      label="Logging streak"
      align="end"
      className="w-64 p-3"
      triggerLabel={`Logging streak: ${days(currentStreak)}`}
      triggerClassName="me-1 inline-flex h-7 items-center gap-[5px] rounded-chip border border-line bg-surface px-[9px] text-xs font-medium text-ink-2 transition-colors hover:border-line-strong"
      trigger={
        <>
          <Flame className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span className="font-mono tabular-nums">{currentStreak}d</span>
        </>
      }
    >
      <p className="text-section font-semibold text-ink">Logging streak</p>
      <p className="mt-0.5 text-xs text-ink-3">
        A day counts when you log food, water, a habit, a workout or steps by hand.
      </p>
      <dl className="mt-3 grid grid-cols-2 divide-x divide-line overflow-hidden rounded-control border border-line bg-surface">
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <dt className="text-xs text-ink-3">Current</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums tracking-[-0.02em] text-ink">
            {currentStreak}
            <span className="text-xs font-normal text-ink-3"> d</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <dt className="text-xs text-ink-3">Best</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums tracking-[-0.02em] text-ink">
            {longestStreak}
            <span className="text-xs font-normal text-ink-3"> d</span>
          </dd>
        </div>
      </dl>
      <p className="mt-2.5 text-xs text-ink-2">
        {isLoggedToday ? "Today counts already." : "Log something today to keep it going."}{" "}
        <span className="text-ink-3">
          Active <span className="font-mono tabular-nums">{consistencyRate30d}%</span> of the last 30 days.
        </span>
      </p>
    </Popover>
  );
}

export default StreakChip;
