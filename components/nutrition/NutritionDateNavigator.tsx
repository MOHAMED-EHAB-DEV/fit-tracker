"use client";

import React, { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { NutritionCalendarPopover } from "@/components/nutrition/NutritionCalendarPopover";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { addDays, formatDateString } from "@/lib/time";
import { EARLIEST_LOG_DATE } from "@/lib/nutrition/meal-time";

interface NutritionDateNavigatorProps {
  /** "YYYY-MM-DD" being shown. */
  selectedDate: string;
  /** The user's today, computed on the server in the user's zone. */
  todayStr: string;
  /** Days that have meals (calendar dots). */
  datesWithMeals?: string[];
}

const navButton =
  "w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export function NutritionDateNavigator({ selectedDate, todayStr, datesWithMeals = [] }: NutritionDateNavigatorProps) {
  const router = useRouter();
  const tz = useUserTimeZone();
  const [isPending, startTransition] = useTransition();
  const [showCalendar, setShowCalendar] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isToday = selectedDate === todayStr;
  const isYesterday = selectedDate === addDays(todayStr, -1);
  const title = formatDateString(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const navigateTo = (target: string) => {
    const now = todayInZone(tz);
    const clamped = target > now ? now : target < EARLIEST_LOG_DATE ? EARLIEST_LOG_DATE : target;
    startTransition(() => {
      router.push(clamped === now ? "/nutrition" : `/nutrition?date=${clamped}`);
    });
  };

  const previousDay = addDays(selectedDate, -1);
  const nextDay = addDays(selectedDate, 1);

  return (
    <nav
      aria-label="Choose a day"
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/80 border border-white/10"
    >
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
          {isToday && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
              Today
            </span>
          )}
          {isYesterday && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
              Yesterday
            </span>
          )}
          {isPending && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-label="Loading day" />}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {!isToday && (
          <button
            type="button"
            onClick={() => navigateTo(todayInZone(tz))}
            disabled={isPending}
            className="min-h-11 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-sm font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Today
          </button>
        )}

        <button
          type="button"
          onClick={() => navigateTo(previousDay)}
          disabled={isPending || selectedDate <= EARLIEST_LOG_DATE}
          aria-label={`Previous day, ${formatDateString(previousDay)}`}
          className={navButton}
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setShowCalendar((open) => !open)}
            disabled={isPending}
            aria-label="Pick a day from the calendar"
            aria-haspopup="dialog"
            aria-expanded={showCalendar}
            className={`${navButton} text-emerald-300`}
          >
            <Calendar className="w-5 h-5" aria-hidden="true" />
          </button>
          <NutritionCalendarPopover
            isOpen={showCalendar}
            onClose={() => setShowCalendar(false)}
            triggerRef={triggerRef}
            selectedDateStr={selectedDate}
            minDate={EARLIEST_LOG_DATE}
            maxDate={todayStr}
            onSelectDate={navigateTo}
            availableDates={datesWithMeals}
          />
        </div>

        <button
          type="button"
          onClick={() => navigateTo(nextDay)}
          disabled={isPending || isToday || selectedDate >= todayStr}
          aria-label={`Next day, ${formatDateString(nextDay)}`}
          className={navButton}
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default NutritionDateNavigator;
