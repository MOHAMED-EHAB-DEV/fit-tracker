"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { format, parseISO, isToday as checkIsToday, isYesterday as checkIsYesterday } from "date-fns";
import { getTodayDateString } from "@/lib/fitness/timezone";

interface NutritionDateNavigatorProps {
  selectedDate: string; // "YYYY-MM-DD"
  availableDates?: string[]; // Sorted list of dates with recorded data
  minDate?: string;
  maxDate?: string;
}

export function NutritionDateNavigator({
  selectedDate,
  availableDates = [],
  minDate,
  maxDate,
}: NutritionDateNavigatorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const todayStr = getTodayDateString();
  const effectiveMaxDate = maxDate || todayStr;
  const effectiveMinDate = minDate || (availableDates.length > 0 ? availableDates[0] : todayStr);

  const isCurrentToday = selectedDate >= effectiveMaxDate;

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

  // Calculate previous and next available dates with data
  const prevAvailableDate = availableDates.length > 0
    ? [...availableDates].reverse().find((d) => d < selectedDate) || null
    : null;

  const nextAvailableDate = availableDates.length > 0
    ? availableDates.find((d) => d > selectedDate && d <= effectiveMaxDate) || null
    : null;

  const isPrevDisabled = isPending || (availableDates.length > 0 ? !prevAvailableDate : selectedDate <= effectiveMinDate);
  const isNextDisabled = isPending || selectedDate >= effectiveMaxDate || (availableDates.length > 0 ? !nextAvailableDate : false);

  const navigateToDate = (targetDateStr: string) => {
    let clampedDate = targetDateStr;
    if (clampedDate > effectiveMaxDate) clampedDate = effectiveMaxDate;
    if (effectiveMinDate && clampedDate < effectiveMinDate) clampedDate = effectiveMinDate;

    startTransition(() => {
      if (clampedDate === todayStr) {
        router.push("/nutrition");
      } else {
        router.push(`/nutrition?date=${clampedDate}`);
      }
    });
  };

  const handlePrevDay = () => {
    if (prevAvailableDate) {
      navigateToDate(prevAvailableDate);
    }
  };

  const handleNextDay = () => {
    if (nextAvailableDate) {
      navigateToDate(nextAvailableDate);
    }
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      navigateToDate(e.target.value);
    }
  };

  const formattedDateTitle = format(parsedDate, "EEEE, MMMM d, yyyy");

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 shadow-lg">
      {/* Left / Date Label (clickable to pick a date) */}
      <label className="relative cursor-pointer group flex flex-col justify-center select-none">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-tight group-hover:text-emerald-400 transition">
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
        <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition">
          {isCurrentToday ? "Inspect and track today's nutrition log" : `Daily log entry for ${selectedDate}`}
        </span>
        <input
          type="date"
          value={selectedDate}
          min={effectiveMinDate}
          max={effectiveMaxDate}
          onChange={handleDateInput}
          disabled={isPending}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          title="Click to pick a date"
        />
      </label>

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
          disabled={isPrevDisabled}
          aria-label="Previous day with data"
          title={isPrevDisabled ? "No earlier data recorded" : `Go to previous log (${prevAvailableDate || ""})`}
          className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Next Day */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={isNextDisabled}
          aria-label="Next day with data"
          title={isNextDisabled ? "Cannot navigate past today or no newer data" : `Go to next log (${nextAvailableDate || ""})`}
          className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
