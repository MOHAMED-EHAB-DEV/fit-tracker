"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Copy, MoreHorizontal, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/components/ui/Toast";
import { FuelLedger } from "@/components/dashboard/FuelLedger";
import { WaterCell } from "@/components/dashboard/WaterCell";
import { AddMealSheet, type AddMealMode } from "@/components/nutrition/AddMealSheet";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { MEAL_TYPE_LABELS } from "@/constants/nutrition";
import { api, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { createMealRequest } from "@/lib/nutrition/client";
import { sortMealsChronologically } from "@/lib/nutrition/dto";
import { isLoggedOnMealDay, localTimeString } from "@/lib/nutrition/meal-time";
import { formatAmount, sumMacros } from "@/lib/nutrition/totals";
import type { MealPayload } from "@/lib/nutrition/draft";
import type { MealData } from "@/lib/nutrition/types";

export interface EatDayProps {
  meals: MealData[];
  selectedDate: string;
  todayStr: string;
  /** "today", "yesterday" or "Sat, Nov 21". */
  dayLabel: string;
  targetCalories: number | null;
  targetProteinG: number | null;
  waterMl: number;
  waterGoalMl: number | null;
  /** Open the meal sheet at once (deep links: /nutrition/analyze, ?add=scan). */
  initialSheet?: AddMealMode | null;
  /** Above the ledger (the date navigator). */
  header?: React.ReactNode;
  /** Under the actions from 1024px (the week's energy chart). */
  aside?: React.ReactNode;
}

/** A saved meal as a new meal for today, now (Log again). */
function repeatPayload(meal: MealData, today: string, time: string): MealPayload {
  return {
    description: meal.description || "Meal",
    mealType: meal.mealType,
    dateString: today,
    time,
    notes: meal.notes ?? "",
    items: (meal.items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity ?? "",
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber ?? 0,
    })),
    macros: {
      calories: meal.macros.calories,
      protein: meal.macros.protein,
      carbs: meal.macros.carbs,
      fat: meal.macros.fat,
      fiber: meal.macros.fiber ?? 0,
    },
  };
}

/**
 * Eat › Day below the date: the fuel ledger (from the meals shown, so a
 * deleted meal leaves the totals at once), Log meal and Scan meal, and the
 * day's meals in order with Edit, Log again and Delete (with Undo).
 */
export function EatDay({
  meals,
  selectedDate,
  todayStr,
  dayLabel,
  targetCalories,
  targetProteinG,
  waterMl,
  waterGoalMl,
  initialSheet = null,
  header,
  aside,
}: EatDayProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tz = useUserTimeZone();
  const [sheet, setSheet] = useState<{ mode: AddMealMode; meal: MealData | null } | null>(
    initialSheet ? { mode: initialSheet, meal: null } : null
  );
  // The last sheet shown stays rendered while it slides away.
  const [shownSheet, setShownSheet] = useState(sheet);
  if (sheet && sheet !== shownSheet) setShownSheet(sheet);
  const [repeating, setRepeating] = useState<string | null>(null);

  // A deep link that opened the sheet (?add=scan) should not reopen it on a
  // reload or a refresh: the address loses the parameter at once (the sheet
  // stays open: it is this component's state).
  useEffect(() => {
    if (!initialSheet) return;
    router.replace(selectedDate === todayStr ? "/nutrition" : `/nutrition?date=${selectedDate}`, { scroll: false });
  }, [initialSheet, router, selectedDate, todayStr]);
  const isToday = selectedDate === todayStr;

  const removal = useUndoableDelete<MealData>({
    getId: (meal) => meal._id,
    commit: async (meal) => {
      await api(`/api/meals/${encodeURIComponent(meal._id)}`, { method: "DELETE", keepalive: true });
      markDashboardStale();
      router.refresh();
    },
    message: (meal) => `"${meal.description || "Meal"}" deleted`,
    onError: (_meal, error) => toast(errorMessage(error, "The meal could not be deleted."), "error"),
  });

  const visible = sortMealsChronologically(meals.filter((meal) => !removal.isHidden(meal._id)));
  const eaten = sumMacros(visible.map((meal) => meal.macros));

  const logAgain = async (meal: MealData) => {
    if (repeating) return;
    setRepeating(meal._id);
    const today = todayInZone(tz);
    try {
      const copy = await createMealRequest(repeatPayload(meal, today, localTimeString(new Date(), tz)));
      markDashboardStale();
      router.refresh();
      toast(isToday ? "Logged again" : "Logged again for today", "success", {
        action: {
          label: "Undo",
          onClick: () => {
            void api(`/api/meals/${encodeURIComponent(copy._id)}`, { method: "DELETE" })
              .then(() => router.refresh())
              .catch((error) => toast(errorMessage(error, "The meal could not be removed."), "error"));
          },
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "The meal could not be logged again.", "error");
    } finally {
      setRepeating(null);
    }
  };

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-3">
        {header}
        <FuelLedger
          caloriesIn={Math.round(eaten.calories)}
          targetCalories={targetCalories}
          proteinG={Math.round(eaten.protein)}
          targetProteinG={targetProteinG}
          carbsG={Math.round(eaten.carbs)}
          fatG={Math.round(eaten.fat)}
          dayLabel={dayLabel}
          water={<WaterCell key={selectedDate} initialWaterMl={waterMl} goalMl={waterGoalMl} editable={isToday} layout="strip" />}
        />

        <div className="grid grid-cols-[1.25fr_1fr] gap-2">
          <Button size="lg" startContent={<Plus className="h-4 w-4" />} onClick={() => setSheet({ mode: "manual", meal: null })}>
            Log meal
          </Button>
          <Button
            size="lg"
            variant="secondary"
            startContent={<Camera className="h-4 w-4" />}
            onClick={() => setSheet({ mode: "scan", meal: null })}
          >
            Scan meal
          </Button>
        </div>
        {aside && <div className="hidden lg:block">{aside}</div>}
      </div>

      <section aria-labelledby="meals-title" className="space-y-2">
        <SectionHeader
          id="meals-title"
          title="Meals"
          meta={visible.length > 0 ? `${visible.length} logged` : undefined}
        />
        {visible.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title={isToday ? "No meals logged today" : `No meals logged for ${dayLabel}`}
            description="Log a meal by hand, or scan a photo for an AI estimate you check before saving."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {visible.map((meal) => {
              const label = meal.description || "Meal";
              const time =
                meal.loggedAt && meal.dateString && isLoggedOnMealDay(meal.loggedAt, meal.dateString, tz)
                  ? localTimeString(new Date(meal.loggedAt), tz)
                  : null;
              return (
                <li key={meal._id} className="flex items-center gap-1 pe-1.5">
                  <button
                    type="button"
                    onClick={() => setSheet({ mode: "manual", meal })}
                    aria-haspopup="dialog"
                    aria-label={`Edit ${label}, ${formatAmount(meal.macros.calories)} kcal`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-elevated/60 active:bg-elevated cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold text-ink">{label}</span>
                        <span className="inline-flex h-5 shrink-0 items-center rounded-chip bg-elevated px-1.5 text-xs text-ink-3">
                          {MEAL_TYPE_LABELS[meal.mealType] || meal.mealType}
                        </span>
                      </span>
                      {time && (
                        <span className="mt-0.5 block font-mono text-xs tabular-nums text-ink-3" suppressHydrationWarning>
                          {time}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block font-mono text-sm font-medium tabular-nums text-ink">
                        {formatAmount(meal.macros.calories)}
                        <span className="text-xs font-normal text-ink-3"> kcal</span>
                      </span>
                      <span className="block font-mono text-xs tabular-nums text-ink-3">{formatAmount(meal.macros.protein)} g P</span>
                    </span>
                  </button>
                  <Popover
                    role="menu"
                    label={`${label} options`}
                    align="end"
                    className="w-52"
                    triggerLabel={`More options for ${label}`}
                    triggerClassName="grid h-11 w-9 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-elevated hover:text-ink"
                    trigger={<MoreHorizontal className="h-5 w-5" aria-hidden="true" />}
                  >
                    {({ close }) => (
                      <>
                        <MenuItem
                          icon={<Pencil className="h-4 w-4" />}
                          onSelect={() => {
                            close();
                            setSheet({ mode: "manual", meal });
                          }}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem
                          icon={<Copy className="h-4 w-4" />}
                          disabled={repeating !== null}
                          onSelect={() => {
                            close();
                            void logAgain(meal);
                          }}
                        >
                          Log again
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                          tone="danger"
                          icon={<Trash2 className="h-4 w-4" />}
                          onSelect={() => {
                            close();
                            removal.remove(meal);
                          }}
                        >
                          Delete
                        </MenuItem>
                      </>
                    )}
                  </Popover>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddMealSheet
        isOpen={Boolean(sheet)}
        onClose={() => setSheet(null)}
        dateString={selectedDate}
        initialMode={shownSheet?.mode ?? "manual"}
        meal={shownSheet?.meal ?? null}
        onSaved={() => markDashboardStale()}
      />
    </div>
  );
}

export default EatDay;
