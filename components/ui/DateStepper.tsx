"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/Calendar";
import { Popover } from "@/components/ui/Popover";
import { addDays, formatDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

const STEP =
  "grid h-9 w-9 shrink-0 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer";

export interface DateStepperProps {
  /** "YYYY-MM-DD" shown. */
  value: string;
  /** The user's today. */
  today: string;
  onChange: (date: string) => void;
  /** Earliest day that can be chosen. */
  min?: string;
  /** Latest day that can be chosen; null for no limit (planning ahead). Defaults to today. */
  max?: string | null;
  /** 6 = Saturday, 0 = Sunday, 1 = Monday. */
  weekStartsOn?: 0 | 1 | 6;
  /** Days marked with a dot in the calendar. */
  indicatorDates?: string[] | Set<string> | Record<string, unknown>;
  indicatorLabel?: string;
  /** Accessible name of the control ("Choose a day"). */
  label?: string;
  /** A load is running: the bar dims. */
  busy?: boolean;
  className?: string;
}

/**
 * Previous day · the date (opens a calendar) · next day, in one 44px bar.
 * "Today", "Yesterday" or "Tomorrow" sits next to the date.
 */
export function DateStepper({
  value,
  today,
  onChange,
  min = "2000-01-01",
  max,
  weekStartsOn = 6,
  indicatorDates,
  indicatorLabel,
  label = "Choose a day",
  busy = false,
  className,
}: DateStepperProps) {
  const limit = max === undefined ? today : max;
  const relative =
    value === today ? "Today" : value === addDays(today, -1) ? "Yesterday" : value === addDays(today, 1) ? "Tomorrow" : null;
  const previous = addDays(value, -1);
  const next = addDays(value, 1);

  return (
    <nav
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn(
        "flex h-11 items-center justify-between gap-1 rounded-control border border-line bg-surface px-1 transition-opacity",
        busy && "opacity-70",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange(previous)}
        disabled={value <= min}
        aria-label={`Previous day, ${formatDateString(previous)}`}
        className={STEP}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </button>

      <Popover
        label="Pick a day"
        align="center"
        className="p-3"
        triggerLabel={`${formatDateString(value, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}. Pick another day`}
        triggerClassName="flex min-h-9 min-w-0 items-center gap-1.5 rounded-chip px-2 text-sm font-semibold text-ink transition-colors hover:bg-elevated"
        trigger={
          <>
            <span className="truncate">{formatDateString(value)}</span>
            {relative && <span className={cn("text-xs font-medium", relative === "Today" ? "text-accent" : "text-ink-3")}>{relative}</span>}
          </>
        }
      >
        {({ close }) => (
          <Calendar
            value={value}
            onChange={(date) => {
              close();
              onChange(date);
            }}
            minDate={min}
            maxDate={limit ?? undefined}
            today={today}
            weekStartsOn={weekStartsOn}
            indicatorDates={indicatorDates}
            indicatorLabel={indicatorLabel}
            showTodayShortcut={value !== today}
          />
        )}
      </Popover>

      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={limit !== null && value >= limit}
        aria-label={`Next day, ${formatDateString(next)}`}
        className={STEP}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </button>
    </nav>
  );
}

export default DateStepper;
