"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, Users, Search, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { apiRequest, errorMessage, isAbort } from "@/components/admin/api";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import type { AdminPlanDTO, PlanUser } from "@/lib/admin/nutrition-plans";
import type { AdminUserRow } from "@/lib/admin/users";

// ── Form model ──────────────────────────────────────────────────────────────

interface MealForm {
  key: string;
  mealType: string;
  name: string;
  description: string;
  targetCalories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

interface PlanForm {
  name: string;
  description: string;
  targetCalories: string;
  targetProteinG: string;
  targetCarbsG: string;
  targetFatG: string;
  isPublic: boolean;
  meals: MealForm[];
}

type Errors = Record<string, string>;

let mealCounter = 0;
const newKey = () => `meal-${++mealCounter}`;
const text = (value: number) => (Number.isFinite(value) ? String(value) : "");

function emptyMeal(): MealForm {
  return { key: newKey(), mealType: "breakfast", name: "", description: "", targetCalories: "0", protein: "0", carbs: "0", fat: "0", fiber: "0" };
}

function toForm(plan?: AdminPlanDTO | null): PlanForm {
  if (!plan) {
    return { name: "", description: "", targetCalories: "", targetProteinG: "", targetCarbsG: "", targetFatG: "", isPublic: false, meals: [] };
  }
  return {
    name: plan.name,
    description: plan.description,
    targetCalories: text(plan.targetCalories),
    targetProteinG: text(plan.targetProteinG),
    targetCarbsG: text(plan.targetCarbsG),
    targetFatG: text(plan.targetFatG),
    isPublic: plan.isPublic,
    meals: plan.meals.map((meal) => ({
      key: newKey(),
      mealType: meal.mealType,
      name: meal.name,
      description: meal.description,
      targetCalories: text(meal.targetCalories),
      protein: text(meal.macros.protein),
      carbs: text(meal.macros.carbs),
      fat: text(meal.macros.fat),
      fiber: text(meal.macros.fiber),
    })),
  };
}

/** The form without the client-only meal keys, for dirty checks. */
const comparable = (form: PlanForm) =>
  JSON.stringify({
    ...form,
    meals: form.meals.map((meal) => [meal.mealType, meal.name, meal.description, meal.targetCalories, meal.protein, meal.carbs, meal.fat, meal.fiber]),
  });

function readNumber(raw: string, min: number, max: number, integer: boolean, errors: Errors, field: string, required = false): number {
  const value = raw.trim();
  if (value === "") {
    if (required) errors[field] = "Required";
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    errors[field] = `${min.toLocaleString()}–${max.toLocaleString()}`;
    return 0;
  }
  if (integer && !Number.isInteger(parsed)) {
    errors[field] = "Whole number";
    return 0;
  }
  return parsed;
}

/** Validates like the server (lib/validation/admin.ts) and builds the request body. */
function buildBody(form: PlanForm) {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "The plan needs a name";
  const body = {
    name: form.name.trim(),
    description: form.description.trim(),
    targetCalories: readNumber(form.targetCalories, 800, 10_000, true, errors, "targetCalories", true),
    targetProteinG: readNumber(form.targetProteinG, 0, 600, true, errors, "targetProteinG"),
    targetCarbsG: readNumber(form.targetCarbsG, 0, 1500, true, errors, "targetCarbsG"),
    targetFatG: readNumber(form.targetFatG, 0, 500, true, errors, "targetFatG"),
    isPublic: form.isPublic,
    meals: form.meals.map((meal, index) => {
      const prefix = `meals.${index}`;
      if (!meal.name.trim()) errors[`${prefix}.name`] = "Each meal needs a name";
      return {
        mealType: meal.mealType,
        name: meal.name.trim(),
        description: meal.description.trim(),
        targetCalories: readNumber(meal.targetCalories, 0, 5000, false, errors, `${prefix}.targetCalories`),
        macros: {
          protein: readNumber(meal.protein, 0, 500, false, errors, `${prefix}.protein`),
          carbs: readNumber(meal.carbs, 0, 1000, false, errors, `${prefix}.carbs`),
          fat: readNumber(meal.fat, 0, 500, false, errors, `${prefix}.fat`),
          fiber: readNumber(meal.fiber, 0, 200, false, errors, `${prefix}.fiber`),
        },
      };
    }),
  };
  return { body, errors };
}

// ── Small controls (module level so they never remount while typing) ────────

function TextField({
  label,
  value,
  onChange,
  error,
  required,
  numeric,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  numeric?: { min: number; max: number; step: number };
  placeholder?: string;
  multiline?: boolean;
}) {
  const fieldLabel = (
    <>
      {label}
      {required && <span className="text-danger"> *</span>}
    </>
  );
  return multiline ? (
    <Textarea
      label={fieldLabel}
      rows={2}
      maxLength={1000}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      isInvalid={Boolean(error)}
      errorMessage={error}
    />
  ) : (
    <Input
      label={fieldLabel}
      type={numeric ? "number" : "text"}
      inputMode={numeric ? (numeric.step < 1 ? "decimal" : "numeric") : undefined}
      min={numeric?.min}
      max={numeric?.max}
      step={numeric?.step}
      maxLength={numeric ? undefined : 120}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      isInvalid={Boolean(error)}
      errorMessage={error}
    />
  );
}

// ── Assignees ───────────────────────────────────────────────────────────────

function AssigneesPanel({ planId, assigned, onChange }: { planId: string; assigned: PlanUser[]; onChange: (plan: AdminPlanDTO) => void }) {
  const { toast } = useToast();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    // A flag, not an AbortController: a superseded search is ignored, never aborted.
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: term, limit: "8", sortField: "name", sortDir: "asc" });
        const data = await apiRequest<{ users: AdminUserRow[] }>(`/api/admin/users?${params}`);
        if (stale) return;
        setResults(data.users);
        setSearchError(null);
      } catch (err) {
        if (!stale && !isAbort(err)) setSearchError(errorMessage(err));
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      stale = true;
    };
  }, [query]);

  const change = async (user: { id: string; name: string }, action: "add" | "remove") => {
    if (busyId) return;
    setBusyId(user.id);
    try {
      const data = await apiRequest<{ plan: AdminPlanDTO }>(`/api/admin/nutrition/plans/${planId}/assignees`, {
        method: "POST",
        body: action === "add" ? { add: [user.id] } : { remove: [user.id] },
      });
      onChange(data.plan);
      toast(action === "add" ? `Assigned to ${user.name}` : `Unassigned ${user.name}`, "success");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const assignedIds = new Set(assigned.map((user) => user.id));
  const visibleResults = query.trim().length >= 2 ? results : [];

  return (
    <section className="bg-surface border border-line rounded-card p-6 space-y-4" aria-labelledby="assignees-heading">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-ink-2" aria-hidden="true" />
        <h2 id="assignees-heading" className="text-sm font-semibold text-ink">
          Assigned users ({assigned.length})
        </h2>
      </div>
      <p className="text-sm text-ink-2">Assigned users get this plan as their nutrition plan. Changes here are saved immediately.</p>

      {assigned.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((user) => (
            <li key={user.id} className="flex items-center gap-1 pl-3 rounded-control bg-elevated border border-line-strong text-sm text-ink">
              <span>
                {user.name} <span className="text-xs text-ink-2">{user.email}</span>
              </span>
              <button
                type="button"
                onClick={() => change(user, "remove")}
                disabled={busyId !== null}
                className="min-h-11 min-w-11 flex items-center justify-center text-ink-2 hover:text-danger transition cursor-pointer disabled:opacity-40 rounded-control"
                aria-label={`Unassign ${user.name || user.email}`}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Nobody is assigned yet.</p>
      )}

      <div className="space-y-2">
        <Input
          id={searchId}
          label="Find a user to assign"
          type="search"
          value={query}
          maxLength={100}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or email (at least 2 characters)"
          startContent={<Search className="w-4 h-4" />}
        />
        {searchError && <p role="alert" className="text-sm text-danger">{searchError}</p>}
        {visibleResults.length > 0 && (
          <ul className="divide-y divide-line border border-line rounded-control overflow-hidden">
            {visibleResults.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="min-w-0 text-sm text-ink truncate">
                  {user.name} <span className="text-xs text-ink-2">{user.email}</span>
                </span>
                {assignedIds.has(user.id) ? (
                  <span className="text-xs text-ink font-semibold min-h-11 flex items-center">Assigned</span>
                ) : (
                  <Button type="button" size="sm" variant="secondary" onClick={() => change(user, "add")} disabled={busyId !== null} className="min-h-11">
                    Assign
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && visibleResults.length === 0 && !searchError && (
          <p className="text-sm text-ink-2">No matching users.</p>
        )}
      </div>
    </section>
  );
}

// ── Form ────────────────────────────────────────────────────────────────────

export function NutritionPlanForm({ initialPlan = null }: { initialPlan?: AdminPlanDTO | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(initialPlan);

  const [plan, setPlan] = useState(initialPlan);
  const [baseline, setBaseline] = useState(() => toForm(initialPlan));
  const [form, setForm] = useState(baseline);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const savingRef = useRef(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dirty = !navigating && comparable(form) !== comparable(baseline);
  useUnsavedChanges(dirty);

  const setField = (field: keyof Omit<PlanForm, "meals" | "isPublic">) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };
  const setMeal = (index: number, field: keyof Omit<MealForm, "key">) => (value: string) => {
    setForm((current) => ({
      ...current,
      meals: current.meals.map((meal, i) => (i === index ? { ...meal, [field]: value } : meal)),
    }));
    setErrors((current) => ({ ...current, [`meals.${index}.${field}`]: "" }));
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const { body, errors: found } = buildBody(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) {
      setFormError("Some fields need attention. They are marked below.");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      if (isEdit && plan) {
        const data = await apiRequest<{ plan: AdminPlanDTO }>(`/api/admin/nutrition/plans/${plan.id}`, { method: "PATCH", body });
        setPlan(data.plan);
        const next = toForm(data.plan);
        setBaseline(next);
        setForm(next);
        toast("Plan saved", "success");
      } else {
        const data = await apiRequest<{ plan: AdminPlanDTO }>("/api/admin/nutrition/plans", { method: "POST", body });
        toast("Plan created. You can now assign users.", "success");
        // Stay locked while navigating so a second click cannot create a copy.
        setNavigating(true);
        router.replace(`/admin/nutrition/${data.plan.id}`);
        return;
      }
    } catch (err) {
      setFormError(errorMessage(err));
    }
    savingRef.current = false;
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!plan || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/admin/nutrition/plans/${plan.id}`, { method: "DELETE" });
      toast(`"${plan.name}" was deleted`, "success");
      setNavigating(true);
      router.push("/admin/nutrition");
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleteBusy(false);
    }
  };

  const totals = form.meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + (Number(meal.targetCalories) || 0),
      protein: sum.protein + (Number(meal.protein) || 0),
    }),
    { calories: 0, protein: 0 }
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      className="space-y-6 max-w-3xl"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/nutrition"
          className="min-h-11 min-w-11 flex items-center justify-center text-ink-2 hover:text-ink hover:bg-elevated rounded-control transition"
          aria-label="Back to nutrition plans"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-semibold text-ink flex-1">{isEdit ? "Edit nutrition plan" : "New nutrition plan"}</h1>
        {isEdit && (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="min-h-11 min-w-11 flex items-center justify-center text-ink-2 hover:text-danger hover:bg-elevated rounded-control transition cursor-pointer"
            aria-label="Delete plan"
            title="Delete plan"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {formError && (
        <div role="alert" className="bg-surface border border-line rounded-control p-3 text-sm text-danger">
          {formError}
        </div>
      )}

      <section className="bg-surface border border-line rounded-card p-6 space-y-4" aria-labelledby="plan-details">
        <h2 id="plan-details" className="text-sm font-semibold text-ink">Plan details</h2>
        <TextField label="Name" required value={form.name} onChange={setField("name")} error={errors.name} placeholder="e.g. 2,500 kcal muscle gain" />
        <TextField label="Description" multiline value={form.description} onChange={setField("description")} placeholder="Who this plan is for…" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TextField label="Calories" required numeric={{ min: 800, max: 10000, step: 1 }} value={form.targetCalories} onChange={setField("targetCalories")} error={errors.targetCalories} />
          <TextField label="Protein (g)" numeric={{ min: 0, max: 600, step: 1 }} value={form.targetProteinG} onChange={setField("targetProteinG")} error={errors.targetProteinG} />
          <TextField label="Carbs (g)" numeric={{ min: 0, max: 1500, step: 1 }} value={form.targetCarbsG} onChange={setField("targetCarbsG")} error={errors.targetCarbsG} />
          <TextField label="Fat (g)" numeric={{ min: 0, max: 500, step: 1 }} value={form.targetFatG} onChange={setField("targetFatG")} error={errors.targetFatG} />
        </div>
        <Checkbox
          checked={form.isPublic}
          onChange={(e) => setForm((current) => ({ ...current, isPublic: e.target.checked }))}
          label={
            <>
              Public template <span className="text-ink-2">(a label for admins; users only get plans assigned to them)</span>
            </>
          }
        />
      </section>

      {isEdit && plan ? (
        <AssigneesPanel planId={plan.id} assigned={plan.assignedTo} onChange={setPlan} />
      ) : (
        <p className="text-sm text-ink-2">After you create the plan you can assign it to users.</p>
      )}

      <section className="space-y-4" aria-labelledby="plan-meals">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="plan-meals" className="text-base font-semibold text-ink">Daily meal template</h2>
            {form.meals.length > 0 && (
              <p className="text-xs text-ink-2 tabular-nums">
                Meals add up to {Math.round(totals.calories).toLocaleString()} kcal and {Math.round(totals.protein)} g protein.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={form.meals.length >= 12}
            onClick={() => setForm((current) => ({ ...current, meals: [...current.meals, emptyMeal()] }))}
            startContent={<Plus className="w-4 h-4" aria-hidden="true" />}
            className="min-h-11"
          >
            Add meal
          </Button>
        </div>
        {form.meals.length === 0 && (
          <p className="text-center py-8 bg-surface border border-line rounded-card text-sm text-ink-2">No meals yet.</p>
        )}
        {form.meals.map((meal, index) => (
          <fieldset key={meal.key} className="bg-surface border border-line rounded-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-xs font-semibold text-ink-2">Meal {index + 1}</legend>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, meals: current.meals.filter((_, i) => i !== index) }))}
                className="min-h-11 min-w-11 flex items-center justify-center text-ink-2 hover:text-danger transition cursor-pointer rounded-control"
                aria-label={`Remove meal ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select<string>
                id={`${meal.key}-type`}
                label="Meal type"
                options={MEAL_TYPE_OPTIONS}
                value={meal.mealType}
                onChange={(value) => setMeal(index, "mealType")(value)}
              />
              <TextField label="Name" required value={meal.name} onChange={setMeal(index, "name")} error={errors[`meals.${index}.name`]} placeholder="e.g. High-protein breakfast" />
            </div>
            <TextField label="Description" value={meal.description} onChange={setMeal(index, "description")} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <TextField label="Calories" numeric={{ min: 0, max: 5000, step: 1 }} value={meal.targetCalories} onChange={setMeal(index, "targetCalories")} error={errors[`meals.${index}.targetCalories`]} />
              <TextField label="Protein g" numeric={{ min: 0, max: 500, step: 0.1 }} value={meal.protein} onChange={setMeal(index, "protein")} error={errors[`meals.${index}.protein`]} />
              <TextField label="Carbs g" numeric={{ min: 0, max: 1000, step: 0.1 }} value={meal.carbs} onChange={setMeal(index, "carbs")} error={errors[`meals.${index}.carbs`]} />
              <TextField label="Fat g" numeric={{ min: 0, max: 500, step: 0.1 }} value={meal.fat} onChange={setMeal(index, "fat")} error={errors[`meals.${index}.fat`]} />
              <TextField label="Fiber g" numeric={{ min: 0, max: 200, step: 0.1 }} value={meal.fiber} onChange={setMeal(index, "fiber")} error={errors[`meals.${index}.fiber`]} />
            </div>
          </fieldset>
        ))}
      </section>

      <div className="flex flex-wrap justify-end gap-3 pb-8">
        <Link
          href="/admin/nutrition"
          className="inline-flex items-center px-4 min-h-11 text-sm text-ink-2 hover:text-ink hover:bg-elevated rounded-control transition"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSaving}
          disabled={isSaving || navigating || (isEdit && !dirty)}
          startContent={<Save className="w-4 h-4" aria-hidden="true" />}
          className="min-h-11"
        >
          {isSaving || navigating ? "Saving…" : isEdit ? "Save changes" : "Create plan"}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onCancel={() => {
          if (!deleteBusy) setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
        title="Delete plan"
        message={`Delete "${plan?.name || ""}"?${plan?.assignedTo.length ? ` ${plan.assignedTo.length} assigned user(s) will no longer have it.` : ""} This cannot be undone.`}
        confirmLabel="Delete plan"
        destructive
        isWorking={deleteBusy}
        error={deleteError}
      />
    </form>
  );
}

export default NutritionPlanForm;
