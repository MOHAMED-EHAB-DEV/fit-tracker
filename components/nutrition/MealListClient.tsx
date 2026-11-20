"use client";

import Link from "next/link";
import { Camera, UtensilsCrossed } from "lucide-react";
import { MealEntries } from "@/components/nutrition/MealEntries";
import { AddMealButton } from "@/components/nutrition/AddMealButton";
import type { MealData } from "@/lib/nutrition/types";

interface MealListClientProps {
  meals: MealData[];
  selectedDate: string;
  /** "Today", "Yesterday" or a date such as "Mon, Nov 16". */
  dayLabel: string;
  isToday: boolean;
}

export function MealListClient({ meals, selectedDate, dayLabel, isToday }: MealListClientProps) {
  // Today links without a pinned date so a page left open past midnight logs to the new day.
  const analyzeUrl = isToday ? "/nutrition/analyze" : `/nutrition/analyze?date=${selectedDate}`;

  return (
    <section aria-labelledby="meal-list-title" className="p-4 sm:p-6 rounded-[28px] bg-zinc-900/80 border border-white/10 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="meal-list-title" className="font-bold text-base text-white">
          Meals
        </h2>
        <span className="text-sm text-zinc-400">
          {meals.length} {meals.length === 1 ? "meal" : "meals"}
        </span>
      </div>

      <MealEntries
        meals={meals}
        emptyState={
          <div className="text-center py-10 px-4 border border-dashed border-white/10 rounded-2xl bg-zinc-950/40">
            <UtensilsCrossed className="w-9 h-9 text-zinc-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-zinc-200">
              {isToday ? "No meals logged today yet" : `No meals logged for ${dayLabel}`}
            </p>
            <p className="text-sm text-zinc-400 mt-1">Add a meal by hand or snap a photo for an AI estimate.</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <AddMealButton dateString={selectedDate} />
              <Link
                href={analyzeUrl}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition active:scale-95"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Snap meal photo</span>
              </Link>
            </div>
          </div>
        }
      />
    </section>
  );
}

export default MealListClient;
