"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, Users } from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";

export interface PlanMeal {
  mealType: string;
  name: string;
  description: string;
  targetCalories: number;
  macros: { protein: number; carbs: number; fat: number; fiber: number };
  order: number;
}

interface AdminNutritionDetailClientProps {
  id: string;
  initialPlan?: any;
}

export function AdminNutritionDetailClient({ id, initialPlan = null }: AdminNutritionDetailClientProps) {
  const router = useRouter();
  const [form, setForm] = useState<any>(initialPlan ? { ...initialPlan, meals: initialPlan.meals || [] } : null);
  const [assignedUsers, setAssignedUsers] = useState<any[]>(initialPlan?.assignedTo || []);
  const [isLoading, setIsLoading] = useState(!initialPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState({ open: false, isLoading: false });

  useEffect(() => {
    if (!initialPlan) {
      fetch(`/api/admin/nutrition/plans/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setForm({ ...d.plan, meals: d.plan.meals || [] });
            setAssignedUsers(d.plan.assignedTo || []);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, initialPlan]);

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/nutrition/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          targetCalories: Number(form.targetCalories),
          targetProteinG: Number(form.targetProteinG),
          targetCarbsG: Number(form.targetCarbsG),
          targetFatG: Number(form.targetFatG),
          isPublic: form.isPublic,
          meals: form.meals.map((m: PlanMeal, i: number) => ({ ...m, order: i })),
          assignedTo: assignedUsers.map((u: any) => u._id || u),
        }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteModal((m) => ({ ...m, isLoading: true }));
    await fetch(`/api/admin/nutrition/plans/${id}`, { method: "DELETE" });
    router.push("/admin/nutrition");
  };

  const addMeal = () =>
    setForm((f: any) => ({
      ...f,
      meals: [
        ...f.meals,
        {
          mealType: "breakfast",
          name: "",
          description: "",
          targetCalories: 0,
          macros: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
          order: 0,
        },
      ],
    }));

  const removeMeal = (i: number) =>
    setForm((f: any) => ({
      ...f,
      meals: f.meals.filter((_: any, j: number) => j !== i),
    }));

  const updateMeal = (i: number, key: string, value: any) =>
    setForm((f: any) => {
      const meals = [...f.meals];
      if (key.startsWith("macros."))
        meals[i] = {
          ...meals[i],
          macros: {
            ...meals[i].macros,
            [key.slice(7)]: Number(value) || 0,
          },
        };
      else meals[i] = { ...meals[i], [key]: value };
      return { ...f, meals };
    });

  const inputClass =
    "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition";

  if (isLoading) return <div className="h-64 bg-zinc-900 rounded-2xl animate-pulse" />;
  if (!form) return <p className="text-zinc-500">Plan not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-extrabold text-white flex-1">Edit Nutrition Plan</h1>
        <button
          type="button"
          onClick={() => setDeleteModal({ open: true, isLoading: false })}
          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="Delete plan"
        >
          <Trash2 className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
          className="flex items-center gap-2 px-4 py-2 min-h-[40px] bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 transition disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>{isSaving ? "Saving…" : "Save"}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white">Plan Details</h2>
        <div>
          <label htmlFor="plan-edit-name" className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">Name</label>
          <input
            id="plan-edit-name"
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="plan-edit-desc" className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">Description</label>
          <textarea
            id="plan-edit-desc"
            rows={2}
            className={`${inputClass} resize-none`}
            value={form.description}
            onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Target Calories", key: "targetCalories" },
            { label: "Protein (g)", key: "targetProteinG" },
            { label: "Carbs (g)", key: "targetCarbsG" },
            { label: "Fat (g)", key: "targetFatG" },
          ].map((f) => (
            <div key={f.key}>
              <label htmlFor={`plan-edit-${f.key}`} className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">{f.label}</label>
              <input
                id={`plan-edit-${f.key}`}
                type="number"
                className={inputClass}
                value={form[f.key]}
                onChange={(e) => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={form.isPublic}
              onChange={(e) => setForm((f: any) => ({ ...f, isPublic: e.target.checked }))}
            />
            <div className="w-10 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500" />
          </label>
          <span className="text-sm text-zinc-300">Make plan public</span>
        </div>
      </div>

      {assignedUsers.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-white">
              Assigned to {assignedUsers.length} user{assignedUsers.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {assignedUsers.map((u: any) => (
              <div
                key={u._id || u}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
              >
                <span>{u.name || u._id}</span>
                <button
                  type="button"
                  onClick={() => setAssignedUsers((prev) => prev.filter((x: any) => (x._id || x) !== (u._id || u)))}
                  className="text-zinc-500 hover:text-red-400 transition cursor-pointer"
                  aria-label={`Unassign ${u.name || u._id}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Daily Meal Template</h2>
          <button
            type="button"
            onClick={addMeal}
            className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg p-1"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add Meal
          </button>
        </div>
        {form.meals.length === 0 && (
          <div className="text-center py-10 bg-zinc-900/40 border border-zinc-800/40 rounded-2xl">
            <p className="text-zinc-600 text-sm">No meals yet.</p>
          </div>
        )}
        {form.meals.map((meal: PlanMeal, i: number) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">Meal {i + 1}</span>
              <button
                type="button"
                onClick={() => removeMeal(i)}
                className="p-1 text-zinc-600 hover:text-red-400 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-lg"
                aria-label={`Remove meal ${i + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">Meal Type</label>
                <select
                  className={inputClass}
                  value={meal.mealType}
                  onChange={(e) => updateMeal(i, "mealType", e.target.value)}
                >
                  {MEAL_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">Name</label>
                <input
                  className={inputClass}
                  value={meal.name}
                  onChange={(e) => updateMeal(i, "name", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">Description</label>
              <input
                className={inputClass}
                value={meal.description}
                onChange={(e) => updateMeal(i, "description", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Calories", key: "targetCalories", val: meal.targetCalories },
                { label: "Protein", key: "macros.protein", val: meal.macros.protein },
                { label: "Carbs", key: "macros.carbs", val: meal.macros.carbs },
                { label: "Fat", key: "macros.fat", val: meal.macros.fat },
                { label: "Fiber", key: "macros.fiber", val: meal.macros.fiber },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">{f.label}</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={f.val}
                    onChange={(e) => updateMeal(i, f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, isLoading: false })}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Delete "${form.name}" permanently?`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
}

export default AdminNutritionDetailClient;
