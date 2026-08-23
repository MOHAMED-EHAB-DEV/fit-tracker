"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Clock,
  Edit3,
  Trash2,
  Camera,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EditMealModal, MealData } from "@/components/nutrition/EditMealModal";

interface MealListClientProps {
  initialMeals: MealData[];
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
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
        <UtensilsCrossed className="w-6 h-6 text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-2xl overflow-hidden relative shrink-0 border border-white/10 shadow-sm bg-zinc-950">
      <Image
        src={src}
        alt={alt || "Meal photo"}
        fill
        sizes="64px"
        onError={() => setHasError(true)}
        className="object-cover group-hover:scale-105 transition-transform duration-300"
      />
    </div>
  );
}

export function MealListClient({ initialMeals }: MealListClientProps) {
  const router = useRouter();
  const [meals, setMeals] = useState<MealData[]>(initialMeals);
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);
  const [deletingMeal, setDeletingMeal] = useState<MealData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state if server data changes
  React.useEffect(() => {
    setMeals(initialMeals);
  }, [initialMeals]);

  const handleDeleteConfirm = async () => {
    if (!deletingMeal) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/meals/${deletingMeal._id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMeals((prev) => prev.filter((m) => m._id !== deletingMeal._id));
        setDeletingMeal(null);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete meal:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 rounded-[28px] bg-zinc-900/80 backdrop-blur-2xl border border-white/10 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-base text-white">Logged Meals</h3>
        <span className="text-xs text-zinc-400 font-semibold">{meals.length} entries</span>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-zinc-950/40">
          <UtensilsCrossed className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-zinc-300">No meals recorded today</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Snap a meal photo or use voice input to log your nutrition with instant AI breakdown
          </p>
          <Link
            href="/nutrition/analyze"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Snap Meal Photo</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((m) => {
            const time = m.loggedAt
              ? new Date(m.loggedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Today";

            return (
              <div
                key={m._id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-white/6 hover:border-white/15 transition group"
              >
                <MealImageThumbnail
                  src={m.cloudinary?.secureUrl}
                  alt={m.description || "Meal"}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                      {m.mealType.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      <span>{time}</span>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-zinc-100 mt-1 truncate">
                    {m.description || "Logged Meal"}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="block font-black text-base text-white">
                    {m.macros.calories} <span className="text-xs font-semibold text-zinc-400">kcal</span>
                  </span>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    <span className="text-emerald-400 font-bold">P: {m.macros.protein}g</span>
                    <span className="text-amber-400 font-bold">C: {m.macros.carbs}g</span>
                    <span className="text-orange-400 font-bold">F: {m.macros.fat}g</span>
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-white/6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMeal(m)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/8 hover:border-white/15 transition cursor-pointer"
                    title="Edit meal details & macros"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingMeal(m)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-red-500/15 text-zinc-500 hover:text-red-400 border border-white/8 hover:border-red-500/30 transition cursor-pointer"
                    title="Delete meal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Meal Modal */}
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
              Are you sure you want to delete <strong className="text-white">&quot;{deletingMeal.description}&quot;</strong>? This will deduct <strong className="text-emerald-400">{deletingMeal.macros.calories} kcal</strong> from your daily nutrition totals.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMeal(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

export default MealListClient;
