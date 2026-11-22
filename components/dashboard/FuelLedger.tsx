import React from "react";
import Link from "next/link";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { goalProgress } from "@/lib/dashboard/metrics";
import { cn } from "@/lib/utils";

export interface FuelLedgerProps {
  caloriesIn: number;
  targetCalories: number | null;
  proteinG: number;
  targetProteinG: number | null;
  carbsG: number;
  fatG: number;
  /** Today shows steps and water in the bottom row; Eat shows water only. */
  steps?: React.ReactNode;
  water?: React.ReactNode;
  /** "today" or another day's label, for screen readers. */
  dayLabel?: string;
  className?: string;
}

const NUMBER = "font-mono tabular-nums";

export function LedgerLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-ink-3">{children}</span>;
}

/** "142 / 180 g" with a quiet goal part. */
export function LedgerValue({
  value,
  goal,
  unit,
  tone = "ink",
}: {
  value: React.ReactNode;
  goal?: React.ReactNode;
  unit?: string;
  tone?: "ink" | "warn";
}) {
  return (
    <span className={cn(NUMBER, "whitespace-nowrap text-sm font-medium", tone === "warn" ? "text-warn" : "text-ink")}>
      {value}
      <span className="text-xs font-normal text-ink-3">
        {goal !== undefined && goal !== null ? ` / ${goal}` : ""}
        {unit ? ` ${unit}` : ""}
      </span>
    </span>
  );
}

/**
 * The day's fuel: calories left (or over) against the target, protein with a
 * track, carbs and fat, and an optional bottom row (steps, water). Shared by
 * Today and Eat.
 */
export function FuelLedger({
  caloriesIn,
  targetCalories,
  proteinG,
  targetProteinG,
  carbsG,
  fatG,
  steps,
  water,
  dayLabel = "today",
  className,
}: FuelLedgerProps) {
  const calories = goalProgress(caloriesIn, targetCalories);
  const protein = goalProgress(proteinG, targetProteinG);
  const hasTarget = calories.percent !== null && targetCalories !== null;

  return (
    <section
      aria-label={`Calories and macros ${dayLabel}`}
      className={cn("overflow-hidden rounded-card border border-line bg-surface", className)}
    >
      <div className="px-4 pt-3.5 pb-4">
        {hasTarget ? (
          <>
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <p className="min-w-0">
                <span
                  className={cn(
                    NUMBER,
                    "text-[30px] leading-none font-medium tracking-[-0.03em]",
                    calories.isOver ? "text-warn" : "text-ink"
                  )}
                >
                  {(calories.isOver ? calories.overBy : calories.remaining).toLocaleString()}
                </span>
                <span className="ms-1 text-sm text-ink-2">{calories.isOver ? "kcal over" : "kcal left"}</span>
              </p>
              <span className={cn(NUMBER, "shrink-0 text-xs text-ink-3")}>
                {Math.round(caloriesIn).toLocaleString()} of {targetCalories.toLocaleString()}
              </span>
            </div>
            <ProgressTrack
              value={caloriesIn}
              max={targetCalories}
              label={`Calories eaten ${dayLabel}: ${Math.round(caloriesIn)} of ${targetCalories}`}
            />
          </>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <p>
              <span className={cn(NUMBER, "text-[30px] leading-none font-medium tracking-[-0.03em] text-ink")}>
                {Math.round(caloriesIn).toLocaleString()}
              </span>
              <span className="ms-1 text-sm text-ink-2">kcal eaten</span>
            </p>
            <Link href="/settings" className="text-xs font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
              Set a calorie target
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1.25fr_1fr_1fr] divide-x divide-line border-t border-line">
        <div className="flex min-w-0 flex-col gap-[5px] px-3 py-2.5">
          <LedgerLabel>Protein</LedgerLabel>
          <LedgerValue
            value={Math.round(proteinG)}
            goal={protein.percent !== null && targetProteinG !== null ? Math.round(targetProteinG) : undefined}
            unit="g"
          />
          {protein.percent !== null && targetProteinG !== null && (
            <ProgressTrack value={proteinG} max={targetProteinG} size="sm" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-[5px] px-3 py-2.5">
          <LedgerLabel>Carbs</LedgerLabel>
          <LedgerValue value={Math.round(carbsG)} unit="g" />
        </div>
        <div className="flex min-w-0 flex-col gap-[5px] px-3 py-2.5">
          <LedgerLabel>Fat</LedgerLabel>
          <LedgerValue value={Math.round(fatG)} unit="g" />
        </div>
      </div>

      {(steps || water) && (
        <div
          className={cn(
            "grid divide-x divide-line border-t border-line",
            steps && water ? "grid-cols-[0.84fr_1.16fr]" : "grid-cols-1"
          )}
        >
          {steps}
          {water}
        </div>
      )}
    </section>
  );
}

export default FuelLedger;
