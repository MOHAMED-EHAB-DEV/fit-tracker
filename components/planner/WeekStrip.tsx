"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateString, weekDatesOf, type WeekdayKey } from "@/lib/time";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  selectedDate: string;
  today: string;
  weekStartDay: WeekdayKey;
  onSelectDate: (date: string) => void;
}

/**
 * Plan › Schedule: the selected day's week as seven cells (today in accent,
 * the selected day filled), with the previous and next week at the ends.
 */
export function WeekStrip({ selectedDate, today, weekStartDay, onSelectDate }: WeekStripProps) {
  const days = weekDatesOf(selectedDate, weekStartDay);
  const range = `${formatDateString(days[0], { month: "short", day: "numeric" })} – ${formatDateString(days[6], {
    month: "short",
    day: "numeric",
  })}`;

  return (
    <nav aria-label={`Week of ${range}`} className="flex items-stretch gap-1 rounded-control border border-line bg-surface p-1">
      <button
        type="button"
        onClick={() => onSelectDate(addDays(selectedDate, -7))}
        aria-label="Previous week"
        className="grid w-8 shrink-0 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </button>
      <ol className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = day === selectedDate;
          const isToday = day === today;
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`${formatDateString(day, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}`}
                className={cn(
                  "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-chip transition-colors cursor-pointer",
                  isSelected ? "bg-ink text-ink-inverse" : "hover:bg-elevated"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("text-xs", isSelected ? "text-ink-inverse" : isToday ? "font-semibold text-accent" : "text-ink-3")}
                >
                  {formatDateString(day, { weekday: "narrow" })}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-mono text-sm font-medium tabular-nums",
                    isSelected ? "text-ink-inverse" : isToday ? "text-accent" : "text-ink"
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => onSelectDate(addDays(selectedDate, 7))}
        aria-label="Next week"
        className="grid w-8 shrink-0 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink cursor-pointer"
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </button>
    </nav>
  );
}

export default WeekStrip;
