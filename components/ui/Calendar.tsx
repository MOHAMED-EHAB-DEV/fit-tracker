"use client";

import React, { useState, useMemo } from "react";
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
  indicatorDates?: string[] | Set<string> | Record<string, unknown>;
  /** Optional label describing what the indicator dots represent */
  indicatorLabel?: string;
  /** Today ("yyyy-MM-dd") in the user's time zone. Defaults to the device's date. */
  today?: string;
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
  today,
  showTodayShortcut = true,
  className,
  onClose,
}: CalendarProps) {
  const todayStr = useMemo(() => today || format(new Date(), "yyyy-MM-dd"), [today]);
  const todayDate = useMemo(() => parseISO(todayStr), [todayStr]);

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

  // Show the month of a newly selected date (derived during render, no effect).
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parsedValue) {
      setCurrentMonth(startOfMonth(parsedValue));
      setViewingYear(getYear(parsedValue));
    }
  }

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
        "w-72 select-none text-ink",
        className
      )}
    >
      {viewMode === "days" ? (
        <>
          {/* Days View Header with Clickable Month Title */}
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                disabled={!canGoPrev}
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
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
                className="group flex min-h-9 items-center gap-1 rounded-chip px-2 text-sm font-semibold text-ink transition-colors hover:bg-elevated cursor-pointer"
                title="Click to choose from all months of the year"
              >
                <span>{format(currentMonth, "MMMM yyyy")}</span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-3 transition-colors group-hover:text-ink" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                disabled={!canGoNext}
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
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
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
                title="Close calendar"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
            {weekDayLabels.map((lbl) => (
              <span key={lbl} className="text-xs font-medium text-ink-3">
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
                    "relative flex h-9 flex-col items-center justify-center rounded-chip font-mono text-[13px] tabular-nums transition-colors cursor-pointer",
                    isSelected
                      ? "bg-ink font-semibold text-ink-inverse"
                      : isDisabled
                      ? "pointer-events-none text-ink-3 opacity-40"
                      : isCurrentToday
                      ? "border border-accent font-semibold text-accent hover:bg-accent-soft"
                      : isCurrentMonth
                      ? "text-ink hover:bg-elevated"
                      : "text-ink-3 hover:bg-elevated/60"
                  )}
                >
                  <span>{format(day, "d")}</span>

                  {/* Indicator dot */}
                  {hasIndicator && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ink-2" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Months View: Year Header & 12 Months Grid */}
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewingYear((y) => y - 1)}
                disabled={!canGoPrevYear}
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
                title="Previous year"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono text-sm font-semibold tabular-nums text-ink">
                {viewingYear}
              </span>

              <button
                type="button"
                onClick={() => setViewingYear((y) => y + 1)}
                disabled={!canGoNextYear}
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
                title="Next year"
                aria-label="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode("days")}
              className="min-h-9 rounded-chip px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-elevated hover:text-ink cursor-pointer"
            >
              Back to days
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-1.5 py-2.5">
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
                    "min-h-11 rounded-control px-2 text-center text-[13px] font-medium transition-colors cursor-pointer",
                    isSelectedMonth
                      ? "bg-ink font-semibold text-ink-inverse"
                      : isMonthDisabled
                      ? "pointer-events-none text-ink-3 opacity-40"
                      : isTodayMonth
                      ? "border border-accent text-accent hover:bg-accent-soft"
                      : isViewingCurrent
                      ? "border border-line-strong bg-elevated text-ink"
                      : "text-ink-2 hover:bg-elevated hover:text-ink"
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
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs">
        {indicatorSet && indicatorSet.size > 0 && viewMode === "days" ? (
          <span className="flex items-center gap-1.5 text-xs text-ink-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-2" />
            <span>{indicatorLabel}</span>
          </span>
        ) : (
          <span className="text-xs text-ink-3">
            {format(todayDate, "EEE, MMM d, yyyy")}
          </span>
        )}

        {showTodayShortcut && (
          <button
            type="button"
            onClick={handleSelectToday}
            disabled={isDateDisabled(todayDate)}
            className="min-h-9 rounded-chip border border-line bg-elevated px-2.5 text-xs font-medium text-ink transition-colors hover:border-line-strong disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>
    </div>
  );
}

export default Calendar;
