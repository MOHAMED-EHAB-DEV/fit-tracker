"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AddMealButton } from "@/components/nutrition/AddMealButton";
import { useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { toMealDTO, type MealDocLike } from "@/lib/nutrition/dto";
import { isLoggedOnMealDay } from "@/lib/nutrition/meal-time";
import { formatTimeInZone } from "@/lib/time";

const SHOWN = 3;

/** Meals today: the latest three, and Log meal. The full list lives in Eat. */
export function MealsToday({ meals, todayStr }: { meals: MealDocLike[]; todayStr: string }) {
  const tz = useUserTimeZone();
  const all = meals.map((meal) => toMealDTO(meal));
  const latest = [...all]
    .sort((a, b) => new Date(b.loggedAt ?? 0).getTime() - new Date(a.loggedAt ?? 0).getTime())
    .slice(0, SHOWN);

  return (
    <section aria-labelledby="meals-today-title" className="space-y-2">
      <SectionHeader
        id="meals-today-title"
        title="Meals today"
        meta={all.length > 0 ? `${all.length} logged` : undefined}
      />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {latest.map((meal) => {
          const time =
            meal.loggedAt && meal.dateString && isLoggedOnMealDay(meal.loggedAt, meal.dateString, tz)
              ? formatTimeInZone(meal.loggedAt, tz)
              : null;
          const protein = Math.round(meal.macros.protein || 0);
          return (
            <li key={meal._id}>
              <Link
                href="/nutrition"
                className="flex min-h-[46px] items-center justify-between gap-3 px-3.5 py-2 transition-colors hover:bg-elevated/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{meal.description || "Meal"}</span>
                  <span className="block font-mono text-xs tabular-nums text-ink-3">
                    {[time, `${protein} g protein`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[13px] font-medium tabular-nums text-ink-2">
                  {Math.round(meal.macros.calories || 0).toLocaleString()} kcal
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <AddMealButton dateString={todayStr}>
            {(open) => (
              <button
                type="button"
                onClick={open}
                className="flex min-h-[46px] w-full items-center justify-between gap-3 px-3.5 py-2 text-start transition-colors hover:bg-elevated/60 cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid h-[26px] w-[26px] place-items-center rounded-chip border border-line bg-elevated text-ink-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-ink">Log meal</span>
                  {all.length === 0 && <span className="text-xs text-ink-3">Nothing logged yet today</span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
              </button>
            )}
          </AddMealButton>
        </li>
      </ul>
    </section>
  );
}

export default MealsToday;
