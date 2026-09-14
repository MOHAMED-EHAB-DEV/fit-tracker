"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowRight, SunMedium } from "lucide-react";
import { format, parseISO, addDays, subDays, isToday, isTomorrow } from "date-fns";
import { getTodayDateString } from "@/lib/fitness/timezone";

interface PlannerDayPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export default function PlannerDayPicker({
  selectedDate,
  onSelectDate,
}: PlannerDayPickerProps) {
  const todayStr = useMemo(() => getTodayDateString(), []);
  const tomorrowStr = useMemo(() => {
    return format(addDays(parseISO(todayStr), 1), "yyyy-MM-dd");
  }, [todayStr]);

  const parsedCurrent = useMemo(() => parseISO(selectedDate), [selectedDate]);
  const isSelectedToday = isToday(parsedCurrent);
  const isSelectedTomorrow = isTomorrow(parsedCurrent);

  const handlePrevDay = () => {
    const prev = subDays(parsedCurrent, 1);
    onSelectDate(format(prev, "yyyy-MM-dd"));
  };

  const handleNextDay = () => {
    const next = addDays(parsedCurrent, 1);
    onSelectDate(format(next, "yyyy-MM-dd"));
  };

  const formattedDayTitle = useMemo(() => {
    if (isSelectedToday) return "Today";
    if (isSelectedTomorrow) return "Tomorrow";
    return format(parsedCurrent, "EEEE");
  }, [isSelectedToday, isSelectedTomorrow, parsedCurrent]);

  const formattedDateSubtitle = useMemo(() => {
    return format(parsedCurrent, "MMMM d, yyyy");
  }, [parsedCurrent]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md">
      {/* Date Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          aria-label="Previous Day"
        >
          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
        </button>

        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-zinc-950/70 border border-zinc-800/60 rounded-xl">
          <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-col text-start">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">
                {formattedDayTitle}
              </span>
              {isSelectedToday && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                  Active
                </span>
              )}
              {isSelectedTomorrow && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
                  Planning
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">
              {formattedDateSubtitle}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
          aria-label="Next Day"
        >
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
      </div>

      {/* Quick Shortcuts: Today & Setup Next Day */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {!isSelectedToday && (
          <button
            type="button"
            onClick={() => onSelectDate(todayStr)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 transition-all"
          >
            <SunMedium className="w-3.5 h-3.5 text-amber-400" />
            Today
          </button>
        )}

        {!isSelectedTomorrow && (
          <button
            type="button"
            onClick={() => onSelectDate(tomorrowStr)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-all shadow-sm shadow-emerald-500/20"
          >
            Setup Next Day
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}
