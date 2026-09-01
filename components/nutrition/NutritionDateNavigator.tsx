"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Sparkles, Loader2 } from "lucide-react";
import { format, parseISO, addDays, subDays, isToday as checkIsToday, isYesterday as checkIsYesterday } from "date-fns";
import { getTodayDateString } from "@/lib/fitness/timezone";

interface NutritionDateNavigatorProps {
  selectedDate: string; // "YYYY-MM-DD"
}

export function NutritionDateNavigator({ selectedDate }: NutritionDateNavigatorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const todayStr = getTodayDateString();
  const isCurrentToday = selectedDate === todayStr;

  let parsedDate: Date;
  try {
    parsedDate = parseISO(selectedDate);
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }
  } catch {
    parsedDate = new Date();
  }

  const isYesterday = checkIsYesterday(parsedDate);
  const isToday = checkIsToday(parsedDate);

  const navigateToDate = (targetDateStr: string) => {
    startTransition(() => {
      if (targetDateStr === todayStr) {
        router.push("/nutrition");
      } else {
        router.push(`/nutrition?date=${targetDateStr}`);
      }
    });
  };

  const handlePrevDay = () => {
    const prev = format(subDays(parsedDate, 1), "yyyy-MM-dd");
    navigateToDate(prev);
  };

  const handleNextDay = () => {
    const next = format(addDays(parsedDate, 1), "yyyy-MM-dd");
    navigateToDate(next);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      navigateToDate(e.target.value);
    }
  };

  const formattedDateTitle = format(parsedDate, "EEEE, MMMM d, yyyy");

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 shadow-lg">
      {/* Left / Date Label */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">
              {formattedDateTitle}
            </span>
            {isCurrentToday && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                Today
              </span>
            )}
            {isYesterday && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                Yesterday
              </span>
            )}
            {isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            )}
          </div>
          <span className="text-xs text-zinc-400">
            {isCurrentToday ? "Inspect and track today's nutrition log" : `Daily log entry for ${selectedDate}`}
          </span>
        </div>
      </div>

      {/* Right / Controls */}
      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        {/* Quick jump to Today */}
        {!isCurrentToday && (
          <button
            type="button"
            onClick={() => navigateToDate(todayStr)}
            disabled={isPending}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer me-1 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            <span>Today</span>
          </button>
        )}

        {/* Previous Day */}
        <button
          type="button"
          onClick={handlePrevDay}
          disabled={isPending}
          aria-label="Previous day"
          className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Hidden/Custom Date Picker button */}
        <label className="relative p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 cursor-pointer">
          <Calendar className="w-4 h-4" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateInput}
            disabled={isPending}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>

        {/* Next Day */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={isPending}
          aria-label="Next day"
          className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
