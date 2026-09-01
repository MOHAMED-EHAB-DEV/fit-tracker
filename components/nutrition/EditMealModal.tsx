"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Utensils,
  Check,
  Loader2,
  Edit3,
  Flame,
  Target,
  Wheat,
  Droplet,
  Leaf,
  Sparkles,
  Info,
  Clock,
  Calendar,
  Camera,
  ShieldCheck,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import { MealType } from "@/types/fitness";
import { Modal } from "@/components/ui/Modal";
import { MEAL_TYPE_OPTIONS as MEAL_TYPES } from "@/constants/nutrition";

export interface MealData {
  _id: string;
  description: string;
  mealType: MealType;
  loggedAt?: string | Date;
  dateString?: string;
  imageSource?: "photo" | "text_only";
  isManualOverride?: boolean;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  aiMacros?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    confidence?: "high" | "medium" | "low";
    confidenceReason?: string;
    geminiNotes?: string;
    modelUsed?: string;
  } | null;
  cloudinary?: {
    secureUrl: string;
    publicId?: string;
  } | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: MealData | null;
  onUpdated?: () => void;
}

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

  const numCalories = Math.max(0, parseInt(calories, 10) || 0);
  const numProtein = Math.max(0, parseFloat(protein) || 0);
  const numCarbs = Math.max(0, parseFloat(carbs) || 0);
  const numFat = Math.max(0, parseFloat(fat) || 0);
  const numFiber = Math.max(0, parseFloat(fiber) || 0);

  const proteinKcal = Math.round(numProtein * 4);
  const carbsKcal = Math.round(numCarbs * 4);
  const fatKcal = Math.round(numFat * 9);
  const calculatedMacroKcal = proteinKcal + carbsKcal + fatKcal;

  const effectiveTotalKcal = numCalories > 0 ? numCalories : calculatedMacroKcal || 1;
  const proteinPct = Math.round((proteinKcal / (calculatedMacroKcal || 1)) * 100);
  const carbsPct = Math.round((carbsKcal / (calculatedMacroKcal || 1)) * 100);
  const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

  const adjustValue = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    currentVal: string,
    delta: number,
    isFloat = false
  ) => {
    const parsed = isFloat ? parseFloat(currentVal) || 0 : parseInt(currentVal, 10) || 0;
    const nextVal = Math.max(0, parsed + delta);
    setter(isFloat ? (Number.isInteger(nextVal) ? nextVal.toString() : nextVal.toFixed(1)) : nextVal.toString());
  };

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
            calories: numCalories,
            protein: numProtein,
            carbs: numCarbs,
            fat: numFat,
            fiber: numFiber,
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

  const formattedDate = meal.loggedAt
    ? new Date(meal.loggedAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : meal.dateString || "Today";

  const formattedTime = meal.loggedAt
    ? new Date(meal.loggedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2 text-white">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Edit3 className="w-4 h-4" />
          </div>
          <span>Edit Meal Entry & Macros</span>
        </div>
      }
      description="Update meal description, category timing, and fine-tune exact macronutrient grams."
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-start">
        {/* Status Alerts */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Meal Context Card & Photo Header */}
        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            {meal.cloudinary?.secureUrl ? (
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-zinc-900 shadow-md">
                <Image
                  src={meal.cloudinary.secureUrl}
                  alt={meal.description || "Meal photo"}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
                <Utensils className="w-6 h-6 text-zinc-600" />
              </div>
            )}

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                  {meal.mealType.replace("_", " ")}
                </span>

                {meal.imageSource === "photo" || meal.aiMacros ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                    <Sparkles className="w-3 h-3 text-teal-400" />
                    AI Vision
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md border border-white/5">
                    <Utensils className="w-3 h-3 text-zinc-400" />
                    Manual Log
                  </span>
                )}

                {meal.isManualOverride && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <Edit3 className="w-3 h-3 text-amber-400" />
                    Adjusted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formattedDate}</span>
                </div>
                {formattedTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{formattedTime}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Macro Summary Tag */}
          <div className="flex sm:flex-col items-baseline sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
            <span className="text-lg sm:text-xl font-black text-white tabular-nums">
              {numCalories} <span className="text-xs text-zinc-400 font-medium">kcal</span>
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">
              Calculated sum: {calculatedMacroKcal} kcal
            </span>
          </div>
        </div>

        {/* AI Dietitian Notes if Available */}
        {meal.aiMacros && (meal.aiMacros.geminiNotes || meal.aiMacros.confidenceReason) && (
          <div className="p-3.5 rounded-2xl bg-teal-950/20 border border-teal-500/20 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>AI Dietitian Assessment</span>
              </span>
              {meal.aiMacros.confidence && (
                <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/20 uppercase">
                  {meal.aiMacros.confidence} Confidence
                </span>
              )}
            </div>
            {meal.aiMacros.geminiNotes && (
              <p className="text-xs text-zinc-300 italic">
                &ldquo;{meal.aiMacros.geminiNotes}&rdquo;
              </p>
            )}
            {meal.aiMacros.confidenceReason && (
              <p className="text-[11px] text-zinc-400">
                {meal.aiMacros.confidenceReason}
              </p>
            )}
          </div>
        )}

        {/* Live Macronutrient Energy Ratio Bar & Percentage Cards */}
        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
              Live Caloric Macro Distribution
            </span>
            <span className="text-zinc-400 font-medium text-[11px]">
              {numCalories} kcal total ({calculatedMacroKcal} kcal from macros)
            </span>
          </div>

          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden flex border border-white/5">
            <div
              style={{ width: `${proteinPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Protein: ${proteinPct}%`}
            />
            <div
              style={{ width: `${carbsPct}%` }}
              className="h-full bg-amber-400 transition-all duration-300"
              title={`Carbs: ${carbsPct}%`}
            />
            <div
              style={{ width: `${fatPct}%` }}
              className="h-full bg-orange-500 transition-all duration-300"
              title={`Fat: ${fatPct}%`}
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-zinc-900/80 border border-emerald-500/20 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Protein
              </span>
              <span className="text-sm font-extrabold text-white block tabular-nums mt-0.5">
                {numProtein.toFixed(1)}g
              </span>
              <span className="text-[10px] text-zinc-400 block tabular-nums">
                {proteinKcal} kcal ({proteinPct}%)
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-amber-500/20 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Carbs
              </span>
              <span className="text-sm font-extrabold text-white block tabular-nums mt-0.5">
                {numCarbs.toFixed(1)}g
              </span>
              <span className="text-[10px] text-zinc-400 block tabular-nums">
                {carbsKcal} kcal ({carbsPct}%)
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-orange-500/20 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">
                Fat
              </span>
              <span className="text-sm font-extrabold text-white block tabular-nums mt-0.5">
                {numFat.toFixed(1)}g
              </span>
              <span className="text-[10px] text-zinc-400 block tabular-nums">
                {fatKcal} kcal ({fatPct}%)
              </span>
            </div>

            <div className="p-2 rounded-xl bg-zinc-900/80 border border-teal-500/20 text-center col-span-3 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">
                Fiber
              </span>
              <span className="text-sm font-extrabold text-white block tabular-nums mt-0.5">
                {numFiber.toFixed(1)}g
              </span>
              <span className="text-[10px] text-zinc-400 block">
                Digestive
              </span>
            </div>
          </div>
        </div>

        {/* Editable Main Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Meal Description / Items
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 200g Grilled Chicken Breast + Basmati Rice"
              className="w-full px-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-2xl text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

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
        </div>

        {/* Macro Inputs with Quick Increment Buttons */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Macronutrient Breakdown (Grams & Energy)
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Calories */}
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  <span>Calories</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">kcal</span>
              </div>
              <input
                type="number"
                min="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-black text-base focus:outline-none focus:ring-1 focus:ring-orange-400 tabular-nums"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setCalories, calories, -25)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  -25
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setCalories, calories, 25)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  +25
                </button>
              </div>
            </div>

            {/* Protein */}
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Protein</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">g</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-black text-base focus:outline-none focus:ring-1 focus:ring-emerald-400 tabular-nums"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setProtein, protein, -5, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  -5g
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setProtein, protein, 5, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  +5g
                </button>
              </div>
            </div>

            {/* Carbs */}
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Wheat className="w-3 h-3" />
                  <span>Carbs</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">g</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-black text-base focus:outline-none focus:ring-1 focus:ring-amber-400 tabular-nums"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setCarbs, carbs, -5, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  -5g
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setCarbs, carbs, 5, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  +5g
                </button>
              </div>
            </div>

            {/* Fat */}
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1">
                  <Droplet className="w-3 h-3" />
                  <span>Fat</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">g</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-black text-base focus:outline-none focus:ring-1 focus:ring-orange-300 tabular-nums"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setFat, fat, -2, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  -2g
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setFat, fat, 2, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  +2g
                </button>
              </div>
            </div>

            {/* Fiber */}
            <div className="p-3 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                  <Leaf className="w-3 h-3" />
                  <span>Fiber</span>
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">g</span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={fiber}
                onChange={(e) => setFiber(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-xl text-white font-black text-base focus:outline-none focus:ring-1 focus:ring-teal-400 tabular-nums"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => adjustValue(setFiber, fiber, -1, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  -1g
                </button>
                <button
                  type="button"
                  onClick={() => adjustValue(setFiber, fiber, 1, true)}
                  className="flex-1 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold transition flex items-center justify-center cursor-pointer"
                >
                  +1g
                </button>
              </div>
            </div>
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
