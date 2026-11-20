"use client";

import React, { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, Edit3, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { deleteMealAction } from "@/lib/nutrition/actions";
import { sortMealsChronologically } from "@/lib/nutrition/dto";
import { isLoggedOnMealDay } from "@/lib/nutrition/meal-time";
import { formatAmount } from "@/lib/nutrition/totals";
import { formatTimeInZone } from "@/lib/time";
import { MEAL_TYPE_LABELS } from "@/constants/nutrition";
import type { MealData } from "@/lib/nutrition/types";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), { ssr: false });
const EditMealModal = dynamic(
  () => import("@/components/nutrition/EditMealModal").then((mod) => mod.EditMealModal),
  { ssr: false }
);

function MealThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
        <UtensilsCrossed className="w-5 h-5 text-zinc-400" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 rounded-2xl overflow-hidden relative shrink-0 border border-white/10 bg-zinc-950">
      <Image src={src} alt={alt} fill sizes="56px" onError={() => setFailed(true)} className="object-cover" />
    </div>
  );
}

interface MealEntriesProps {
  meals: MealData[];
  /** Rendered when there are no meals left to show. */
  emptyState: React.ReactNode;
}

/** A day's meals with edit and delete, shared by the Nutrition page and the dashboard. */
export function MealEntries({ meals, emptyState }: MealEntriesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tz = useUserTimeZone();
  const [editing, setEditing] = useState<MealData | null>(null);
  const [deleting, setDeleting] = useState<MealData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const deletingRef = useRef(false);

  const visible = sortMealsChronologically(meals.filter((meal) => !hiddenIds.has(meal._id)));

  const confirmDelete = async () => {
    if (!deleting || deletingRef.current) return;
    const target = deleting;
    deletingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    setHiddenIds((prev) => new Set(prev).add(target._id));
    try {
      const result = await deleteMealAction(target._id);
      if (!result.success) throw new Error(result.error || "The meal could not be deleted.");
      setDeleting(null);
      toast("Meal deleted", "success");
      router.refresh();
    } catch (err) {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(target._id);
        return next;
      });
      setDeleteError(err instanceof Error ? err.message : "The meal could not be deleted. Please try again.");
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <>
      {visible.length === 0 ? (
        emptyState
      ) : (
        <ul className="space-y-3">
          {visible.map((meal) => {
            const time =
              meal.loggedAt && meal.dateString && isLoggedOnMealDay(meal.loggedAt, meal.dateString, tz)
                ? formatTimeInZone(meal.loggedAt, tz)
                : null;
            const label = meal.description || "Meal";
            return (
              <li
                key={meal._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MealThumbnail src={meal.images?.[0]?.secureUrl} alt={label} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {MEAL_TYPE_LABELS[meal.mealType] || meal.mealType}
                      </span>
                      {time && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span suppressHydrationWarning>{time}</span>
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-zinc-100 mt-1 truncate">{label}</p>
                    {meal.items && meal.items.length > 0 && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{meal.items.map((item) => item.name).join(", ")}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/8 shrink-0">
                  <div className="text-start sm:text-end">
                    <span className="block font-bold text-base text-white tabular-nums">
                      {formatAmount(meal.macros.calories)} <span className="text-xs font-medium text-zinc-400">kcal</span>
                    </span>
                    <div className="flex items-center gap-2 text-xs mt-0.5 tabular-nums">
                      <span className="text-emerald-300">P {formatAmount(meal.macros.protein)}g</span>
                      <span className="text-amber-300">C {formatAmount(meal.macros.carbs)}g</span>
                      <span className="text-rose-300">F {formatAmount(meal.macros.fat)}g</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ps-2 border-s border-white/8">
                    <button
                      type="button"
                      onClick={() => setEditing(meal)}
                      aria-label={`Edit ${label}`}
                      className="w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(meal);
                      }}
                      aria-label={`Delete ${label}`}
                      className="w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-900 hover:bg-red-500/15 text-zinc-200 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EditMealModal
          isOpen
          meal={editing}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {deleting && (
        <Modal
          isOpen
          onClose={() => !isDeleting && setDeleting(null)}
          size="sm"
          title="Delete this meal?"
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button type="button" variant="bordered" size="md" onClick={() => setDeleting(null)} disabled={isDeleting}>
                Keep it
              </Button>
              <Button type="button" variant="danger" size="md" onClick={confirmDelete} isLoading={isDeleting}>
                Delete meal
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">
              <strong className="text-white">{deleting.description || "This meal"}</strong> (
              {formatAmount(deleting.macros.calories)} kcal) and its photos will be removed, and the day&apos;s totals
              updated. This can&apos;t be undone.
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                {deleteError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export default MealEntries;
