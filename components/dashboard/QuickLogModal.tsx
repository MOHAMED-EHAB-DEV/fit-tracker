"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  UtensilsCrossed,
  Droplets,
  Scale,
  Footprints,
  Check,
  Loader2,
} from "lucide-react";
import { MealType } from "@/types/fitness";
import { Modal } from "@/components/ui/Modal";
import { MEAL_TYPE_OPTIONS, WATER_QUICK_AMOUNTS } from "@/constants/nutrition";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWaterMl: number;
}

type TabType = "food" | "water" | "weight" | "steps";

export function QuickLogModal({
  isOpen,
  onClose,
  initialWaterMl,
}: QuickLogModalProps) {
  const router = useRouter();
  const { isNative, steps: nativeSteps } = useNativeStepTracker();
  const [activeTab, setActiveTab] = useState<TabType>("food");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Food Form State
  const [mealDescription, setMealDescription] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealCarbs, setMealCarbs] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [mealType, setMealType] = useState<MealType>("snack");

  // Weight Form State
  const [weightKg, setWeightKg] = useState("");
  const [bodyFat, setBodyFat] = useState("");

  // Steps Form State
  const [stepsCount, setStepsCount] = useState("");

  const handleLogFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealCalories || !mealDescription.trim()) {
      setErrorMsg("Please enter description and calories");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: mealDescription.trim(),
          mealType,
          macros: {
            calories: parseInt(mealCalories, 10) || 0,
            protein: parseFloat(mealProtein) || 0,
            carbs: parseFloat(mealCarbs) || 0,
            fat: parseFloat(mealFat) || 0,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to log meal");

      setSuccessMsg("Meal logged successfully!");
      router.refresh();
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        setMealDescription("");
        setMealCalories("");
        setMealProtein("");
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log meal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogWater = async (amount: number) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Water Intake (+${amount}ml)`,
          mealType: "snack",
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          waterDelta: amount,
        }),
      });

      if (!res.ok) throw new Error("Failed to update water");

      setSuccessMsg(`Added +${amount}ml water!`);
      router.refresh();
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update hydration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weightKg) {
      setErrorMsg("Please enter your weight in kg");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/body-comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: parseFloat(weightKg),
          bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
          notes: "Fasted morning weigh-in",
        }),
      });

      if (!res.ok) throw new Error("Failed to save weigh-in");

      setSuccessMsg("Weight recorded & metrics updated!");
      router.refresh();
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log weight");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogSteps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepsCount) {
      setErrorMsg("Please enter step count");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/steps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: parseInt(stepsCount, 10),
          source: "manual",
        }),
      });

      if (!res.ok) throw new Error("Failed to sync steps");

      setSuccessMsg("Steps logged!");
      router.refresh();
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log steps");
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
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Plus className="w-4 h-4" />
          </div>
          <span>Quick Log</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="grid grid-cols-4 p-1.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("food")}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === "food"
                ? "bg-zinc-800 text-emerald-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Food</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("water")}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === "water"
                ? "bg-zinc-800 text-cyan-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Water</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("weight")}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === "weight"
                ? "bg-zinc-800 text-amber-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Weight</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("steps")}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === "steps"
                ? "bg-zinc-800 text-blue-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Steps</span>
          </button>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* FOOD TAB */}
        {activeTab === "food" && (
          <form onSubmit={handleLogFood} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Description / Item
              </label>
              <input
                type="text"
                placeholder="e.g. Protein shake + 1 Banana"
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Calories (kcal) *
                </label>
                <input
                  type="number"
                  placeholder="350"
                  value={mealCalories}
                  onChange={(e) => setMealCalories(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Protein (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="30"
                  value={mealProtein}
                  onChange={(e) => setMealProtein(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-amber-400 mb-1">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="25"
                  value={mealCarbs}
                  onChange={(e) => setMealCarbs(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-orange-400 mb-1">
                  Fat (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="5"
                  value={mealFat}
                  onChange={(e) => setMealFat(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                  Meal Type
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full px-2 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs"
                >
                  {MEAL_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Log Food</span>}
            </button>
          </form>
        )}

        {/* WATER TAB */}
        {activeTab === "water" && (
          <div className="space-y-5 text-center py-2">
            <p className="text-xs text-zinc-400">
              Quickly add hydration to today&apos;s log
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {WATER_QUICK_AMOUNTS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => handleLogWater(ml)}
                  disabled={isSubmitting}
                  className="py-4 px-3 rounded-2xl bg-zinc-950 border border-cyan-500/20 hover:border-cyan-500/60 hover:bg-cyan-500/10 text-cyan-400 font-bold transition flex flex-col items-center gap-1 group active:scale-95"
                >
                  <Droplets className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400" />
                  <span className="text-base text-white">+{ml} ml</span>
                  <span className="text-[10px] text-zinc-500">
                    {ml === 250 ? "1 Glass" : ml === 500 ? "1 Bottle" : `${ml / 1000}L`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WEIGHT TAB */}
        {activeTab === "weight" && (
          <form onSubmit={handleLogWeight} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Morning Bodyweight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 74.8"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Estimated Body Fat % (Optional)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 14.5"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Record Weigh-In</span>}
            </button>
          </form>
        )}

        {/* STEPS TAB */}
        {activeTab === "steps" && (
          <form onSubmit={handleLogSteps} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-400">
                  Total Steps for Today *
                </label>
                {isNative && nativeSteps > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepsCount(String(nativeSteps))}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Use Sensor ({nativeSteps.toLocaleString()})</span>
                  </button>
                )}
              </div>
              <input
                type="number"
                placeholder="e.g. 8500"
                value={stepsCount}
                onChange={(e) => setStepsCount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Sync Steps</span>}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
