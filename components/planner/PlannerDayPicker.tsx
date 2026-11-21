"use client";

import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowRight, SunMedium } from "lucide-react";
import { addDays, formatDateString } from "@/lib/time";

interface PlannerDayPickerProps {
  selectedDate: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD in the user's zone
  onSelectDate: (date: string) => void;
}

export default function PlannerDayPicker({ selectedDate, today, onSelectDate }: PlannerDayPickerProps) {
  const tomorrow = addDays(today, 1);
  const isSelectedToday = selectedDate === today;
  const isSelectedTomorrow = selectedDate === tomorrow;

  const dayTitle = isSelectedToday
    ? "Today"
    : isSelectedTomorrow
      ? "Tomorrow"
      : selectedDate === addDays(today, -1)
        ? "Yesterday"
        : formatDateString(selectedDate, { weekday: "long" });
  const dateSubtitle = formatDateString(selectedDate, { weekday: "short", month: "long", day: "numeric", year: "numeric" });

  return (
    <nav
      aria-label="Choose a day"
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectDate(addDays(selectedDate, -1))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
        </button>

        <div
          className="flex-1 sm:flex-initial flex items-center gap-2.5 px-3 py-1.5 bg-zinc-950/70 border border-zinc-800/60 rounded-xl"
          aria-live="polite"
        >
          <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="flex flex-col text-start">
            <span className="text-sm font-semibold text-zinc-100">{dayTitle}</span>
            <span className="text-xs text-zinc-400">{dateSubtitle}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectDate(addDays(selectedDate, 1))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {!isSelectedToday && (
          <button
            type="button"
            onClick={() => onSelectDate(today)}
            className="flex items-center gap-1.5 px-3 min-h-11 text-xs font-medium rounded-xl text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 transition-all"
          >
            <SunMedium className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            Today
          </button>
        )}
        {!isSelectedTomorrow && (
          <button
            type="button"
            onClick={() => onSelectDate(tomorrow)}
            className="flex items-center gap-1.5 px-3.5 min-h-11 text-xs font-semibold rounded-xl text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-all"
          >
            Plan tomorrow
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
          </button>
        )}
      </div>
    </nav>
  );
}
