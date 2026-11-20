"use client";

import Link from "next/link";
import { Camera, Plus, UtensilsCrossed } from "lucide-react";
import { MealEntries } from "@/components/nutrition/MealEntries";
import { toMealDTO, type MealDocLike } from "@/lib/nutrition/dto";

interface MealTimelineProps {
  /** Today's meals (serialized Meal documents or MealData). */
  meals: MealDocLike[];
}

const ANALYZE_FROM_DASHBOARD = "/nutrition/analyze?from=dashboard";

export function MealTimeline({ meals }: MealTimelineProps) {
  const normalized = meals.map((meal) => toMealDTO(meal));

  return (
    <section aria-labelledby="meal-timeline-title" className="p-4 sm:p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400 shrink-0">
            <UtensilsCrossed className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="meal-timeline-title" className="font-bold text-base text-white">
              Today&apos;s meals
            </h3>
            <p className="text-sm text-zinc-400">In the order you ate them</p>
          </div>
        </div>

        <Link
          href={ANALYZE_FROM_DASHBOARD}
          className="flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-sm font-semibold border border-emerald-500/30 transition shrink-0"
        >
          <Camera className="w-4 h-4" aria-hidden="true" />
          <span>Snap meal</span>
        </Link>
      </div>

      <MealEntries
        meals={normalized}
        emptyState={
          <div className="text-center py-8 px-4 border border-dashed border-zinc-800 rounded-xl">
            <UtensilsCrossed className="w-8 h-8 text-zinc-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-zinc-200 font-medium">No meals logged today yet</p>
            <p className="text-sm text-zinc-400 mt-0.5">Snap a photo or use Quick Log to add one.</p>
            <Link
              href={ANALYZE_FROM_DASHBOARD}
              className="inline-flex items-center gap-1.5 mt-4 min-h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-100 text-sm font-semibold border border-zinc-700 transition"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Log first meal</span>
            </Link>
          </div>
        }
      />
    </section>
  );
}

export default MealTimeline;
