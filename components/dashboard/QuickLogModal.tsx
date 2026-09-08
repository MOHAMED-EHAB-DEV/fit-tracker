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
  Trash2,
} from "lucide-react";
import { MealType } from "@/types/fitness";
import { Modal } from "@/components/ui/Modal";
import { MEAL_TYPE_OPTIONS, WATER_QUICK_AMOUNTS } from "@/constants/nutrition";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";

interface QuickLogItem {
  name: string;
  quantity?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

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
  const [mealFiber, setMealFiber] = useState("");
  const [mealType, setMealType] = useState<MealType>("snack");

  // Ingredients State
  const [items, setItems] = useState<QuickLogItem[]>([]);
  const [showIngredients, setShowIngredients] = useState(false);
  const [ingName, setIngName] = useState("");
  const [ingQty, setIngQty] = useState("");
  const [ingCalories, setIngCalories] = useState("");
  const [ingProtein, setIngProtein] = useState("");
  const [ingCarbs, setIngCarbs] = useState("");
  const [ingFat, setIngFat] = useState("");
  const [ingFiber, setIngFiber] = useState("");

  // Weight Form State
  const [weightKg, setWeightKg] = useState("");
  const [bodyFat, setBodyFat] = useState("");

  // Steps Form State
  const [stepsCount, setStepsCount] = useState("");

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim()) return;
    const p = parseFloat(ingProtein) || 0;
    const c = parseFloat(ingCarbs) || 0;
    const f = parseFloat(ingFat) || 0;
    const fib = parseFloat(ingFiber) || 0;
    const cal = ingCalories ? parseInt(ingCalories, 10) : Math.round(p * 4 + c * 4 + f * 9);

    const newItem: QuickLogItem = {
      name: ingName.trim(),
      quantity: ingQty.trim(),
      calories: cal,
      protein: p,
      carbs: c,
      fat: f,
      fiber: fib,
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);

    const totalCal = nextItems.reduce((sum, it) => sum + it.calories, 0);
    const totalP = nextItems.reduce((sum, it) => sum + it.protein, 0);
    const totalC = nextItems.reduce((sum, it) => sum + it.carbs, 0);
    const totalF = nextItems.reduce((sum, it) => sum + it.fat, 0);
    const totalFib = nextItems.reduce((sum, it) => sum + (it.fiber || 0), 0);

    setMealCalories(String(Math.round(totalCal)));
    setMealProtein(totalP.toFixed(1));
    setMealCarbs(totalC.toFixed(1));
    setMealFat(totalF.toFixed(1));
    setMealFiber(totalFib.toFixed(1));

    if (!mealDescription.trim()) {
      setMealDescription(nextItems.map((it) => it.name).join(", "));
    }

    setIngName("");
    setIngQty("");
    setIngCalories("");
    setIngProtein("");
    setIngCarbs("");
    setIngFat("");
    setIngFiber("");
  };

  const handleRemoveIngredient = (index: number) => {
    const nextItems = items.filter((_, idx) => idx !== index);
    setItems(nextItems);
    if (nextItems.length > 0) {
      const totalCal = nextItems.reduce((sum, it) => sum + it.calories, 0);
      const totalP = nextItems.reduce((sum, it) => sum + it.protein, 0);
      const totalC = nextItems.reduce((sum, it) => sum + it.carbs, 0);
      const totalF = nextItems.reduce((sum, it) => sum + it.fat, 0);
      const totalFib = nextItems.reduce((sum, it) => sum + (it.fiber || 0), 0);

      setMealCalories(String(Math.round(totalCal)));
      setMealProtein(totalP.toFixed(1));
      setMealCarbs(totalC.toFixed(1));
      setMealFat(totalF.toFixed(1));
      setMealFiber(totalFib.toFixed(1));
    }
  };

  const handleSyncTotals = () => {
    if (items.length === 0) return;
    const totalCal = items.reduce((sum, it) => sum + it.calories, 0);
    const totalP = items.reduce((sum, it) => sum + it.protein, 0);
    const totalC = items.reduce((sum, it) => sum + it.carbs, 0);
    const totalF = items.reduce((sum, it) => sum + it.fat, 0);
    const totalFib = items.reduce((sum, it) => sum + (it.fiber || 0), 0);

    setMealCalories(String(Math.round(totalCal)));
    setMealProtein(totalP.toFixed(1));
    setMealCarbs(totalC.toFixed(1));
    setMealFat(totalF.toFixed(1));
    setMealFiber(totalFib.toFixed(1));
  };

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
          items: items.length > 0 ? items : undefined,
          macros: {
            calories: parseInt(mealCalories, 10) || 0,
            protein: parseFloat(mealProtein) || 0,
            carbs: parseFloat(mealCarbs) || 0,
            fat: parseFloat(mealFat) || 0,
            fiber: parseFloat(mealFiber) || 0,
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
        setMealCarbs("");
        setMealFat("");
        setMealFiber("");
        setItems([]);
        setShowIngredients(false);
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
        }),
      });

      if (!res.ok) throw new Error("Failed to sync steps");

      setSuccessMsg("Steps synchronized!");
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
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400" aria-hidden="true">
            <Plus className="w-4 h-4" />
          </div>
          <span>Quick Log</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div role="tablist" aria-label="Quick Log Categories" className="grid grid-cols-4 p-1.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-xs font-semibold gap-1 select-none">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "food"}
            onClick={() => setActiveTab("food")}
            className={`py-2 px-2 min-h-10 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeTab === "food"
                ? "bg-zinc-800 text-emerald-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Food</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "water"}
            onClick={() => setActiveTab("water")}
            className={`py-2 px-2 min-h-10 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              activeTab === "water"
                ? "bg-zinc-800 text-cyan-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Droplets className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Water</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "weight"}
            onClick={() => setActiveTab("weight")}
            className={`py-2 px-2 min-h-10 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              activeTab === "weight"
                ? "bg-zinc-800 text-amber-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Weight</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "steps"}
            onClick={() => setActiveTab("steps")}
            className={`py-2 px-2 min-h-10 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              activeTab === "steps"
                ? "bg-zinc-800 text-blue-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Steps</span>
          </button>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div role="status" className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* FOOD TAB */}
        {activeTab === "food" && (
          <form onSubmit={handleLogFood} className="space-y-4">
            <div>
              <label htmlFor="quick-food-desc" className="block text-xs font-semibold text-zinc-400 mb-1 select-none">
                Description / Item *
              </label>
              <input
                id="quick-food-desc"
                type="text"
                required
                placeholder="e.g. Protein shake + 1 Banana"
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quick-food-cal" className="block text-xs font-semibold text-zinc-400 mb-1 select-none">
                  Calories (kcal) *
                </label>
                <input
                  id="quick-food-cal"
                  type="number"
                  required
                  placeholder="350"
                  value={mealCalories}
                  onChange={(e) => setMealCalories(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="quick-food-protein" className="block text-xs font-semibold text-emerald-400 mb-1 select-none">
                  Protein (g)
                </label>
                <input
                  id="quick-food-protein"
                  type="number"
                  step="0.1"
                  placeholder="30"
                  value={mealProtein}
                  onChange={(e) => setMealProtein(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="quick-food-carbs" className="block text-[10px] font-semibold text-amber-400 mb-1 select-none">
                  Carbs (g)
                </label>
                <input
                  id="quick-food-carbs"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="25"
                  value={mealCarbs}
                  onChange={(e) => setMealCarbs(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                />
              </div>
              <div>
                <label htmlFor="quick-food-fat" className="block text-[10px] font-semibold text-orange-400 mb-1 select-none">
                  Fat (g)
                </label>
                <input
                  id="quick-food-fat"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="5"
                  value={mealFat}
                  onChange={(e) => setMealFat(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="quick-food-fiber" className="block text-[10px] font-semibold text-teal-400 mb-1 select-none">
                  Fiber (g)
                </label>
                <input
                  id="quick-food-fiber"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="5"
                  value={mealFiber}
                  onChange={(e) => setMealFiber(e.target.value)}
                  className="w-full px-3 py-2 min-h-10 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                />
              </div>
            </div>

            {/* Ingredients Breakdown Section */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowIngredients(!showIngredients)}
                  className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Ingredients {items.length > 0 && `(${items.length})`}</span>
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncTotals}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    Sync to Totals
                  </button>
                )}
              </div>

              {showIngredients && (
                <div className="space-y-3 pt-1">
                  {/* Inline Ingredient Add Form */}
                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-emerald-500/20 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Ingredient *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Greek Yogurt"
                          value={ingName}
                          onChange={(e) => setIngName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Portion / Weight
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 150g"
                          value={ingQty}
                          onChange={(e) => setIngQty(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 mb-0.5">Cal (kcal)</label>
                        <input
                          type="number"
                          placeholder="120"
                          value={ingCalories}
                          onChange={(e) => setIngCalories(e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-emerald-400 mb-0.5">P (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="15"
                          value={ingProtein}
                          onChange={(e) => setIngProtein(e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-amber-400 mb-0.5">C (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="6"
                          value={ingCarbs}
                          onChange={(e) => setIngCarbs(e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-orange-400 mb-0.5">F (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="2"
                          value={ingFat}
                          onChange={(e) => setIngFat(e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-teal-400 mb-0.5">Fib (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={ingFiber}
                          onChange={(e) => setIngFiber(e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      disabled={!ingName.trim()}
                      className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      + Add Ingredient to List
                    </button>
                  </div>

                  {/* List of Added Ingredients */}
                  {items.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pe-1">
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 p-2 rounded-xl bg-zinc-900/70 border border-zinc-800 text-start"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate me-2">
                              <span className="text-zinc-200 font-semibold text-xs">{it.name}</span>
                              {it.quantity && (
                                <span className="text-zinc-500 text-[11px] ms-1">({it.quantity})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-amber-400 font-bold text-xs tabular-nums">
                                {it.calories} kcal
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredient(idx)}
                                className="p-0.5 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold text-zinc-400">
                            <span className="text-emerald-400 tabular-nums">P: {it.protein}g</span>
                            <span className="text-amber-400 tabular-nums">C: {it.carbs}g</span>
                            <span className="text-orange-400 tabular-nums">F: {it.fat}g</span>
                            <span className="text-teal-400 tabular-nums">Fib: {it.fiber || 0}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="quick-food-type" className="block text-xs font-semibold text-zinc-400 mb-1 select-none">
                Meal Type
              </label>
              <select
                id="quick-food-type"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                {MEAL_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3 min-h-11 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <span>Log Food</span>}
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
                  aria-busy={isSubmitting}
                  aria-label={`Add ${ml} milliliters of water`}
                  className="py-4 px-3 min-h-12 rounded-2xl bg-zinc-950 border border-cyan-500/20 hover:border-cyan-500/60 hover:bg-cyan-500/10 text-cyan-400 font-bold transition flex flex-col items-center gap-1 group active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
                >
                  <Droplets className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400" aria-hidden="true" />
                  <span className="text-base text-white tabular-nums">+{ml} ml</span>
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
              <label htmlFor="quick-weight-val" className="block text-xs font-semibold text-zinc-400 mb-1 select-none">
                Morning Bodyweight (kg) *
              </label>
              <input
                id="quick-weight-val"
                type="number"
                step="0.1"
                required
                placeholder="e.g. 74.8"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="quick-weight-bf" className="block text-xs font-semibold text-zinc-400 mb-1 select-none">
                Estimated Body Fat % (Optional)
              </label>
              <input
                id="quick-weight-bf"
                type="number"
                step="0.1"
                placeholder="e.g. 14.5"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3 min-h-11 bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <span>Record Weigh-In</span>}
            </button>
          </form>
        )}

        {/* STEPS TAB */}
        {activeTab === "steps" && (
          <form onSubmit={handleLogSteps} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="quick-steps-val" className="block text-xs font-semibold text-zinc-400 select-none">
                  Total Steps for Today *
                </label>
                {isNative && nativeSteps > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepsCount(String(nativeSteps))}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                  >
                    <span>Use Sensor ({nativeSteps.toLocaleString()})</span>
                  </button>
                )}
              </div>
              <input
                id="quick-steps-val"
                type="number"
                required
                placeholder="e.g. 8500"
                value={stepsCount}
                onChange={(e) => setStepsCount(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-3 min-h-11 bg-linear-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <span>Sync Steps</span>}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default QuickLogModal;
