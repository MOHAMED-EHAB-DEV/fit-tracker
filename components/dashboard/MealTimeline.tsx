"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Plus, Clock, Camera, Edit3, Trash2, Loader2 } from "lucide-react";
import type { MealData } from "@/components/nutrition/EditMealModal";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), {
  ssr: false,
});

const EditMealModal = dynamic(
  () => import("@/components/nutrition/EditMealModal").then((mod) => mod.EditMealModal),
  { ssr: false }
);

interface MealTimelineProps {
  meals: MealData[];
}

function MealImageThumbnail({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
        <UtensilsCrossed className="w-5 h-5 text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-xl overflow-hidden relative shrink-0 border border-zinc-800 bg-zinc-950">
      <Image
        src={src}
        alt={alt || "Meal photo"}
        fill
        sizes="56px"
        onError={() => setHasError(true)}
        className="object-cover group-hover:scale-105 transition-transform duration-300"
      />
    </div>
  );
}

import { deleteMealAction } from "@/lib/fitness/actions";

export function MealTimeline({ meals }: MealTimelineProps) {
  const router = useRouter();
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);
  const [deletingMeal, setDeletingMeal] = useState<MealData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingMeal) return;

    setIsDeleting(true);
    try {
      const res = await deleteMealAction(deletingMeal._id);
      if (res.success) {
        setDeletingMeal(null);
      }
    } catch (err) {
      console.error("Failed to delete meal:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Today&apos;s Meals</h3>
            <p className="text-xs text-zinc-400">Macro log & nutrition timeline</p>
          </div>
        </div>

        <Link
          href="/nutrition/analyze"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Snap Meal</span>
        </Link>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
          <UtensilsCrossed className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400 font-medium">No meals logged today yet</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Take a photo or describe what you ate to track calories & macros
          </p>
          <Link
            href="/nutrition/analyze"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log First Meal</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => {
            const time = new Date(meal.loggedAt as string | Date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit", 
            });

            return (
              <div
                key={meal._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/60 transition group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MealImageThumbnail
                    src={meal.cloudinary?.secureUrl}
                    alt={meal.description || "Meal photo"}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                        {meal.mealType.replace("_", " ")}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{time}</span>
                      </div>
                    </div>
                    <p className="font-semibold text-sm text-zinc-200 truncate mt-1">
                      {meal.description || "Logged Meal"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60 shrink-0">
                  <div className="text-start sm:text-end">
                    <span className="block font-bold text-sm text-white tabular-nums">
                      {meal.macros.calories} kcal
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5 flex-wrap">
                      <span className="text-emerald-400 font-medium tabular-nums">P: {Number(meal.macros.protein).toFixed(1)}g</span>
                      <span className="text-amber-400 font-medium tabular-nums">C: {Number(meal.macros.carbs).toFixed(1)}g</span>
                      <span className="text-orange-400 font-medium tabular-nums">F: {Number(meal.macros.fat).toFixed(1)}g</span>
                    </div>
                  </div>

                  {/* Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1 ps-2 border-s border-zinc-800/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingMeal(meal)}
                      className="p-1.5 sm:p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition cursor-pointer"
                      title="Edit meal"
                      aria-label={`Edit ${meal.description || "meal"}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingMeal(meal)}
                      className="p-1.5 sm:p-2 rounded-lg bg-zinc-900 hover:bg-red-500/15 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/30 transition cursor-pointer"
                      title="Delete meal"
                      aria-label={`Delete ${meal.description || "meal"}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingMeal && (
        <EditMealModal
          isOpen={true}
          onClose={() => setEditingMeal(null)}
          meal={editingMeal}
          onUpdated={() => {
            setEditingMeal(null);
            router.refresh();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingMeal && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingMeal(null)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>Delete Meal Entry</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">&quot;{deletingMeal.description}&quot;</strong>? This will deduct <strong className="text-emerald-400">{deletingMeal.macros.calories} kcal</strong> from your daily totals.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMeal(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Meal</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default MealTimeline;
