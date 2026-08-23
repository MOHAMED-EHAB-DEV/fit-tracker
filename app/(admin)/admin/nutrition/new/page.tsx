"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";

interface PlanMeal {
  mealType: string; name: string; description: string;
  targetCalories: number; macros: { protein: number; carbs: number; fat: number; fiber: number }; order: number;
}

const emptyMeal = (): PlanMeal => ({
  mealType: "breakfast", name: "", description: "", targetCalories: 0,
  macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 }, order: 0,
});

export default function AdminNewNutritionPlanPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetCalories, setTargetCalories] = useState("");
  const [targetProteinG, setTargetProteinG] = useState("");
  const [targetCarbsG, setTargetCarbsG] = useState("");
  const [targetFatG, setTargetFatG] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [meals, setMeals] = useState<PlanMeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetCalories) { setError("Name and target calories are required."); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nutrition/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, isPublic,
          targetCalories: Number(targetCalories),
          targetProteinG: Number(targetProteinG) || 0,
          targetCarbsG: Number(targetCarbsG) || 0,
          targetFatG: Number(targetFatG) || 0,
          meals: meals.map((m, i) => ({ ...m, order: i })),
        }),
      });
      const data = await res.json();
      if (data.success) router.push(`/admin/nutrition/${data.plan._id}`);
      else setError(data.error || "Failed to create plan");
    } finally { setIsLoading(false); }
  };

  const addMeal = () => setMeals((m) => [...m, emptyMeal()]);
  const removeMeal = (i: number) => setMeals((m) => m.filter((_, j) => j !== i));
  const updateMeal = (i: number, key: string, value: any) => setMeals((prev) => {
    const updated = [...prev];
    if (key.startsWith("macros.")) updated[i] = { ...updated[i], macros: { ...updated[i].macros, [key.slice(7)]: Number(value) || 0 } };
    else updated[i] = { ...updated[i], [key]: value };
    return updated;
  });

  const inputClass = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500/60 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => router.back()} className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-extrabold text-white">New Nutrition Plan</h1>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{error}</div>}

      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white">Plan Details</h2>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Name <span className="text-red-400">*</span></label>
          <input className={inputClass} placeholder="e.g. 2500kcal Muscle Building Plan" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Description</label>
          <textarea rows={2} className={`${inputClass} resize-none`} placeholder="Brief description of this plan…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Target Calories *", value: targetCalories, set: setTargetCalories },
            { label: "Protein (g)", value: targetProteinG, set: setTargetProteinG },
            { label: "Carbs (g)", value: targetCarbsG, set: setTargetCarbsG },
            { label: "Fat (g)", value: targetFatG, set: setTargetFatG },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">{f.label}</label>
              <input type="number" className={inputClass} value={f.value} onChange={(e) => f.set(e.target.value)} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500" />
          </label>
          <span className="text-sm text-zinc-300">Make plan public</span>
        </div>
      </div>

      {/* Meals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Daily Meal Template</h2>
          <button type="button" onClick={addMeal} className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition">
            <Plus className="w-3.5 h-3.5" /> Add Meal
          </button>
        </div>
        {meals.map((meal, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Meal {i + 1}</span>
              <button type="button" onClick={() => removeMeal(i)} className="p-1 text-zinc-600 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Meal Type</label>
                <select className={inputClass} value={meal.mealType} onChange={(e) => updateMeal(i, "mealType", e.target.value)}>
                  {MEAL_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Name</label>
                <input className={inputClass} placeholder="e.g. High Protein Breakfast" value={meal.name} onChange={(e) => updateMeal(i, "name", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Description</label>
              <input className={inputClass} placeholder="Optional description…" value={meal.description} onChange={(e) => updateMeal(i, "description", e.target.value)} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Calories", key: "targetCalories", val: meal.targetCalories, direct: true },
                { label: "Protein", key: "macros.protein", val: meal.macros.protein },
                { label: "Carbs", key: "macros.carbs", val: meal.macros.carbs },
                { label: "Fat", key: "macros.fat", val: meal.macros.fat },
                { label: "Fiber", key: "macros.fiber", val: meal.macros.fiber },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">{f.label}</label>
                  <input type="number" className={inputClass} value={f.val} onChange={(e) => updateMeal(i, f.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <button type="button" onClick={() => router.back()} className="px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition">Cancel</button>
        <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 transition shadow-lg shadow-violet-500/20 disabled:opacity-60">
          <Save className="w-4 h-4" />{isLoading ? "Creating…" : "Create Plan"}
        </button>
      </div>
    </form>
  );
}
