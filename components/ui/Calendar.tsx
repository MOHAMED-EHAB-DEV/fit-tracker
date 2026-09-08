"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isAfter,
  isBefore,
  parseISO,
  subMonths,
  addMonths,
  getYear,
  getMonth,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  /** Selected date in "yyyy-MM-dd" format or null */
  value?: string | null;
  /** Callback fired when user selects a date string ("yyyy-MM-dd") */
  onChange?: (dateStr: string) => void;
  /** Minimum selectable date ("yyyy-MM-dd") */
  minDate?: string;
  /** Maximum selectable date ("yyyy-MM-dd") */
  maxDate?: string;
  /** Week start day: 6 = Saturday (Cairo/Middle-East convention), 0 = Sunday, 1 = Monday */
  weekStartsOn?: 0 | 1 | 6;
  /**
   * Set, array, or object keys representing dates with recorded data/activity
   * Displays an indicator dot under the day
   */
  indicatorDates?: string[] | Set<string> | Record<string, any>;
  /** Optional label describing what the indicator dots represent */
  indicatorLabel?: string;
  /** Whether to show the quick "Today" button in the footer */
  showTodayShortcut?: boolean;
  /** Optional custom class names */
  className?: string;
  /** Optional close button callback if calendar has a close icon in header */
  onClose?: () => void;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  weekStartsOn = 6,
  indicatorDates,
  indicatorLabel = "Days with activity",
  showTodayShortcut = true,
  className,
  onClose,
}: CalendarProps) {
  const todayDate = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(todayDate, "yyyy-MM-dd"), [todayDate]);

  const parsedValue = useMemo(() => {
    if (!value) return null;
    try {
      const d = parseISO(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, [value]);

  const parsedMin = useMemo(() => {
    if (!minDate) return null;
    try {
      const d = parseISO(minDate);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, [minDate]);

  const parsedMax = useMemo(() => {
    if (!maxDate) return null;
    try {
      const d = parseISO(maxDate);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }, [maxDate]);

  // Current viewing month
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    return parsedValue ? startOfMonth(parsedValue) : startOfMonth(todayDate);
  });

  // View mode: "days" grid or "months" year view
  const [viewMode, setViewMode] = useState<"days" | "months">("days");
  const [viewingYear, setViewingYear] = useState<number>(() => getYear(currentMonth));

  // Sync displayed month when value changes
  useEffect(() => {
    if (parsedValue) {
      setCurrentMonth(startOfMonth(parsedValue));
      setViewingYear(getYear(parsedValue));
    }
  }, [parsedValue]);

  // Indicator lookup set for O(1) checks
  const indicatorSet = useMemo(() => {
    if (!indicatorDates) return null;
    if (indicatorDates instanceof Set) return indicatorDates;
    if (Array.isArray(indicatorDates)) return new Set(indicatorDates);
    if (typeof indicatorDates === "object") {
      const set = new Set<string>();
      for (const [k, v] of Object.entries(indicatorDates)) {
        if (Array.isArray(v) ? v.length > 0 : Boolean(v)) {
          set.add(k);
        }
      }
      return set;
    }
    return null;
  }, [indicatorDates]);

  // Calendar day cells
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn });
    const endDate = endOfWeek(monthEnd, { weekStartsOn });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth, weekStartsOn]);

  // Weekday labels
  const weekDayLabels = useMemo(() => {
    const sampleWeekStart = startOfWeek(new Date(), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sampleWeekStart);
      d.setDate(d.getDate() + i);
      return format(d, "EEEEEE"); // Sa, Su, Mo, Tu, We, Th, Fr
    });
  }, [weekStartsOn]);

  const canGoPrev = useMemo(() => {
    if (!parsedMin) return true;
    const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
    return !isBefore(prevMonthEnd, parsedMin);
  }, [currentMonth, parsedMin]);

  const canGoNext = useMemo(() => {
    if (!parsedMax) return true;
    const nextMonthStart = startOfMonth(addMonths(currentMonth, 1));
    return !isAfter(nextMonthStart, parsedMax);
  }, [currentMonth, parsedMax]);

  const canGoPrevYear = useMemo(() => {
    if (!parsedMin) return true;
    return viewingYear > getYear(parsedMin);
  }, [viewingYear, parsedMin]);

  const canGoNextYear = useMemo(() => {
    if (!parsedMax) return true;
    return viewingYear < getYear(parsedMax);
  }, [viewingYear, parsedMax]);

  const isDateDisabled = (day: Date): boolean => {
    if (parsedMax && isAfter(day, parsedMax)) return true;
    if (parsedMin && isBefore(day, parsedMin)) return true;
    return false;
  };

  const handleSelectDay = (day: Date) => {
    if (isDateDisabled(day)) return;
    const formatted = format(day, "yyyy-MM-dd");
    onChange?.(formatted);
  };

  const handleSelectToday = () => {
    if (isDateDisabled(todayDate)) return;
    setCurrentMonth(startOfMonth(todayDate));
    setViewingYear(getYear(todayDate));
    setViewMode("days");
    onChange?.(todayStr);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const newMonthDate = new Date(viewingYear, monthIndex, 1);
    setCurrentMonth(newMonthDate);
    setViewMode("days");
  };

  return (
    <div
      className={cn(
        "w-72 sm:w-80 select-none p-4 rounded-3xl bg-zinc-900/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl text-zinc-100",
        className
      )}
    >
      {viewMode === "days" ? (
        <>
          {/* Days View Header with Clickable Month Title */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                disabled={!canGoPrev}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Click to open Year of Months View */}
              <button
                type="button"
                onClick={() => {
                  setViewingYear(getYear(currentMonth));
                  setViewMode("months");
                }}
                className="flex items-center gap-1 font-extrabold text-sm tracking-tight text-white hover:text-emerald-400 hover:bg-zinc-800/80 px-2 py-1 rounded-xl transition cursor-pointer group"
                title="Click to choose from all months of the year"
              >
                <span>{format(currentMonth, "MMMM yyyy")}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                disabled={!canGoNext}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Close calendar"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 pt-3 pb-1 text-center">
            {weekDayLabels.map((lbl) => (
              <span key={lbl} className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                {lbl}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarDays.map((day) => {
              const dayStr = format(day, "yyyy-MM-dd");
              const isSelected = parsedValue ? isSameDay(day, parsedValue) : false;
              const isCurrentToday = isSameDay(day, todayDate);
              const isDisabled = isDateDisabled(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const hasIndicator = indicatorSet ? indicatorSet.has(dayStr) : false;

              return (
                <button
                  key={dayStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "relative h-8 sm:h-9 flex flex-col items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer active:scale-90",
                    isSelected
                      ? "bg-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/35"
                      : isDisabled
                      ? "opacity-25 pointer-events-none text-zinc-600"
                      : isCurrentToday
                      ? "text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : isCurrentMonth
                      ? "text-zinc-200 hover:bg-zinc-800 hover:text-white"
                      : "text-zinc-600 hover:bg-zinc-800/40"
                  )}
                >
                  <span>{format(day, "d")}</span>

                  {/* Indicator dot */}
                  {hasIndicator && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Months View: Year Header & 12 Months Grid */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewingYear((y) => y - 1)}
                disabled={!canGoPrevYear}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Previous year"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-extrabold text-sm tracking-tight text-white px-2">
                {viewingYear}
              </span>

              <button
                type="button"
                onClick={() => setViewingYear((y) => y + 1)}
                disabled={!canGoNextYear}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                title="Next year"
                aria-label="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode("days")}
              className="text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 px-2.5 py-1 rounded-xl transition cursor-pointer"
            >
              Back to days
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2 py-3">
            {MONTH_NAMES.map((mName, idx) => {
              const monthStartDate = new Date(viewingYear, idx, 1);
              const monthEndDate = endOfMonth(monthStartDate);
              const isMonthDisabled =
                (parsedMax && isAfter(monthStartDate, parsedMax)) ||
                (parsedMin && isBefore(monthEndDate, parsedMin));

              const isSelectedMonth =
                parsedValue &&
                getYear(parsedValue) === viewingYear &&
                getMonth(parsedValue) === idx;

              const isViewingCurrent =
                getYear(currentMonth) === viewingYear &&
                getMonth(currentMonth) === idx;

              const isTodayMonth =
                getYear(todayDate) === viewingYear &&
                getMonth(todayDate) === idx;

              return (
                <button
                  key={mName}
                  type="button"
                  disabled={Boolean(isMonthDisabled)}
                  onClick={() => handleSelectMonth(idx)}
                  className={cn(
                    "py-3 px-2 rounded-2xl text-xs font-bold transition cursor-pointer text-center active:scale-95",
                    isSelectedMonth
                      ? "bg-emerald-500 text-zinc-950 font-black shadow-md shadow-emerald-500/35"
                      : isMonthDisabled
                      ? "opacity-25 pointer-events-none text-zinc-600"
                      : isTodayMonth
                      ? "text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : isViewingCurrent
                      ? "text-white bg-zinc-800 border border-white/15"
                      : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
                  )}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Footer info & shortcut */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10 text-xs">
        {indicatorSet && indicatorSet.size > 0 && viewMode === "days" ? (
          <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span>{indicatorLabel}</span>
          </span>
        ) : (
          <span className="text-[11px] text-zinc-500">
            {format(todayDate, "EEE, MMM d, yyyy")}
          </span>
        )}

        {showTodayShortcut && (
          <button
            type="button"
            onClick={handleSelectToday}
            disabled={isDateDisabled(todayDate)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            <Sparkles className="w-3 h-3" />
            <span>Today</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default Calendar;
