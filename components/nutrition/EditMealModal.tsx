"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Utensils, Check, Loader2, Edit3, Flame } from "lucide-react";
import { MealType } from "@/types/fitness";
import { Modal } from "@/components/ui/Modal";

export interface MealData {
  _id: string;
  description: string;
  mealType: MealType;
  loggedAt?: string | Date;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  cloudinary?: {
    secureUrl: string;
  } | null;
}

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: MealData | null;
  onUpdated?: () => void;
}

import { MEAL_TYPE_OPTIONS as MEAL_TYPES } from "@/constants/nutrition";

export function EditMealModal({
  isOpen,
  onClose,
  meal,
  onUpdated,
}: EditMealModalProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (meal) {
      setDescription(meal.description || "");
      setMealType(meal.mealType || "snack");
      setCalories(meal.macros?.calories?.toString() || "0");
      setProtein(meal.macros?.protein?.toString() || "0");
      setCarbs(meal.macros?.carbs?.toString() || "0");
      setFat(meal.macros?.fat?.toString() || "0");
      setFiber(meal.macros?.fiber?.toString() || "0");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [meal]);

  if (!meal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg("Please enter a meal description");
      return;
    }
    if (!calories || isNaN(Number(calories))) {
      setErrorMsg("Please enter a valid calorie amount");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/meals/${meal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          mealType,
          macros: {
            calories: Math.max(0, parseInt(calories, 10) || 0),
            protein: Math.max(0, parseFloat(protein) || 0),
            carbs: Math.max(0, parseFloat(carbs) || 0),
            fat: Math.max(0, parseFloat(fat) || 0),
            fiber: Math.max(0, parseFloat(fiber) || 0),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update meal");
      }

      setSuccessMsg("Meal updated successfully!");
      if (onUpdated) {
        onUpdated();
      }
      router.refresh();

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update meal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2 text-white">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Edit3 className="w-4 h-4" />
          </div>
          <span>Edit Meal Entry</span>
        </div>
      }
      description="Update meal description, category, and nutritional macro breakdown"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Status Alerts */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Description Field */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Meal Description / Food Items
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 200g Grilled Chicken Breast + Basmati Rice"
            className="w-full px-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-2xl text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            autoFocus
          />
        </div>

        {/* Meal Type Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Meal Timing / Category
          </label>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value as MealType)}
            className="w-full px-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-2xl text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
          >
            {MEAL_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-zinc-900 text-white">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Calories & Protein Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              <span>Calories (kcal) *</span>
            </label>
            <input
              type="number"
              min="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="e.g. 450"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-base focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Utensils className="w-3 h-3" />
              <span>Protein (g)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="e.g. 35"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-base focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Carbs, Fat, Fiber Row */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              Carbs (g)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="e.g. 40"
              className="w-full px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-orange-300 block">
              Fat (g)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="e.g. 12"
              className="w-full px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
              Fiber (g)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={fiber}
              onChange={(e) => setFiber(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-2.5 py-1 bg-zinc-900 border border-white/10 rounded-xl text-white font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditMealModal;
