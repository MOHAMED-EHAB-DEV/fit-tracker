"use client";

import React from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import { MEAL_LIMITS, ITEM_BOUNDS } from "@/lib/validation/nutrition";
import {
  MACRO_LABELS,
  TOTAL_BOUNDS,
  addItemToDraft,
  draftTotals,
  removeItemFromDraft,
  type DraftItem,
  type MealDraft,
} from "@/lib/nutrition/draft";
import { MACRO_KEYS, energySplit, formatAmount, type MacroKey, type Macros } from "@/lib/nutrition/totals";
import { cn } from "@/lib/utils";
import type { MealType } from "@/types/fitness";

const UNIT: Record<MacroKey, string> = { calories: "kcal", protein: "g", carbs: "g", fat: "g", fiber: "g" };
const ACCENT: Record<MacroKey, string> = {
  calories: "text-orange-300",
  protein: "text-emerald-300",
  carbs: "text-amber-300",
  fat: "text-rose-300",
  fiber: "text-teal-300",
};

const inputClass =
  "w-full min-h-11 px-3 py-2 bg-zinc-950/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60";

/** Protein / carbs / fat share of energy; hidden when there is nothing to split. */
export function MacroSplitBar({ macros }: { macros: Partial<Macros> }) {
  const split = energySplit(macros);
  if (!split) {
    return <p className="text-xs text-zinc-400">No protein, carbs or fat entered yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      <div
        className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden flex border border-white/5"
        role="img"
        aria-label={`Energy from protein ${split.proteinPct}%, carbs ${split.carbsPct}%, fat ${split.fatPct}%`}
      >
        <div style={{ width: `${split.proteinPct}%` }} className="h-full bg-emerald-500" />
        <div style={{ width: `${split.carbsPct}%` }} className="h-full bg-amber-400" />
        <div style={{ width: `${split.fatPct}%` }} className="h-full bg-rose-500" />
      </div>
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="text-emerald-300">Protein {split.proteinPct}%</span>
        <span className="text-amber-300">Carbs {split.carbsPct}%</span>
        <span className="text-rose-300">Fat {split.fatPct}%</span>
      </div>
    </div>
  );
}

function AmountInput({
  id,
  label,
  value,
  onChange,
  max,
  disabled,
  required,
  accent,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  disabled?: boolean;
  required?: boolean;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cn("block text-xs font-semibold mb-1 truncate", accent || "text-zinc-300")}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step="any"
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputClass, "px-2.5 tabular-nums")}
      />
    </div>
  );
}

function ItemEditor({
  idPrefix,
  index,
  item,
  isNew,
  disabled,
  onChange,
  onRemove,
}: {
  idPrefix: string;
  index: number;
  item: DraftItem;
  isNew: boolean;
  disabled?: boolean;
  onChange: (next: DraftItem) => void;
  onRemove: () => void;
}) {
  const base = `${idPrefix}-item-${item.key}`;
  const label = item.name.trim() || `ingredient ${index + 1}`;
  return (
    <li className={cn("p-3 rounded-2xl bg-zinc-950/60 border space-y-2.5", isNew ? "border-teal-500/40" : "border-white/8")}>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <label htmlFor={`${base}-name`} className="flex items-center gap-2 text-xs font-semibold text-zinc-300 mb-1">
            <span>Ingredient {index + 1}</span>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded-md bg-teal-500/15 text-teal-300 border border-teal-500/30 text-xs">
                New
              </span>
            )}
          </label>
          <input
            id={`${base}-name`}
            type="text"
            value={item.name}
            maxLength={MEAL_LIMITS.itemNameMax}
            disabled={disabled}
            placeholder="e.g. Grilled chicken breast"
            onChange={(event) => onChange({ ...item, name: event.target.value })}
            className={inputClass}
          />
        </div>
        <div className="w-28 sm:w-36 shrink-0">
          <label htmlFor={`${base}-qty`} className="block text-xs font-semibold text-zinc-300 mb-1">
            Portion
          </label>
          <input
            id={`${base}-qty`}
            type="text"
            value={item.quantity}
            maxLength={MEAL_LIMITS.quantityMax}
            disabled={disabled}
            placeholder="150 g"
            onChange={(event) => onChange({ ...item, quantity: event.target.value })}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${label}`}
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-900 border border-white/10 text-zinc-300 hover:text-red-300 hover:border-red-500/40 transition cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {MACRO_KEYS.map((key) => (
          <AmountInput
            key={key}
            id={`${base}-${key}`}
            label={`${MACRO_LABELS[key]} (${UNIT[key]})`}
            value={item[key]}
            max={ITEM_BOUNDS[key]}
            disabled={disabled}
            accent={ACCENT[key]}
            onChange={(value) => onChange({ ...item, [key]: value })}
          />
        ))}
      </div>
    </li>
  );
}

export interface MealFormProps {
  idPrefix: string;
  draft: MealDraft;
  onChange: (next: MealDraft) => void;
  /** Latest selectable day (the user's today). */
  maxDate: string;
  disabled?: boolean;
  error?: string | null;
  /** Shown above the fields (photos, AI assessment...). */
  headerSlot?: React.ReactNode;
  /** Extra actions next to "Add ingredient" (e.g. Regenerate with AI). */
  itemsToolbarSlot?: React.ReactNode;
  /** Keys of ingredients the AI just added (highlighted). */
  newItemKeys?: ReadonlySet<string>;
}

/** The one meal editor used for adding, editing and reviewing AI results. */
export function MealForm({
  idPrefix,
  draft,
  onChange,
  maxDate,
  disabled,
  error,
  headerSlot,
  itemsToolbarSlot,
  newItemKeys,
}: MealFormProps) {
  const totals = draftTotals(draft);
  const hasItems = draft.items.length > 0;
  const update = (patch: Partial<MealDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-5 text-start">
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {headerSlot}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-description`} className="block text-xs font-semibold text-zinc-300 mb-1">
            What did you eat?
          </label>
          <input
            id={`${idPrefix}-description`}
            type="text"
            value={draft.description}
            maxLength={MEAL_LIMITS.descriptionMax}
            disabled={disabled}
            placeholder="e.g. Chicken rice bowl"
            onChange={(event) => update({ description: event.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-type`} className="block text-xs font-semibold text-zinc-300 mb-1">
            Meal
          </label>
          <select
            id={`${idPrefix}-type`}
            value={draft.mealType}
            disabled={disabled}
            onChange={(event) => update({ mealType: event.target.value as MealType })}
            className={cn(inputClass, "cursor-pointer")}
          >
            {MEAL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-zinc-900">
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${idPrefix}-date`} className="block text-xs font-semibold text-zinc-300 mb-1">
              Day
            </label>
            <input
              id={`${idPrefix}-date`}
              type="date"
              value={draft.dateString}
              max={maxDate}
              min="2000-01-01"
              required
              disabled={disabled}
              onChange={(event) => update({ dateString: event.target.value })}
              className={cn(inputClass, "px-2.5 scheme-dark")}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-time`} className="block text-xs font-semibold text-zinc-300 mb-1">
              Time
            </label>
            <input
              id={`${idPrefix}-time`}
              type="time"
              value={draft.time}
              required
              disabled={disabled}
              onChange={(event) => update({ time: event.target.value })}
              className={cn(inputClass, "px-2.5 scheme-dark")}
            />
          </div>
        </div>
      </div>

      <section aria-labelledby={`${idPrefix}-totals-title`} className="p-4 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h3 id={`${idPrefix}-totals-title`} className="text-sm font-bold text-white">
            Totals
          </h3>
          <span className="text-xs text-zinc-400">
            {hasItems ? "Added up from the ingredients" : "Enter the totals, or add ingredients below"}
          </span>
        </div>

        {hasItems ? (
          <dl className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {MACRO_KEYS.map((key) => (
              <div key={key} className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/8 text-center">
                <dt className={cn("text-xs font-semibold", ACCENT[key])}>{MACRO_LABELS[key]}</dt>
                <dd className="text-base font-extrabold text-white tabular-nums">
                  {formatAmount(totals[key])}
                  <span className="text-xs font-medium text-zinc-400 ms-0.5">{UNIT[key]}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {MACRO_KEYS.map((key) => (
              <AmountInput
                key={key}
                id={`${idPrefix}-total-${key}`}
                label={`${MACRO_LABELS[key]}${key === "calories" ? " *" : ""} (${UNIT[key]})`}
                value={draft.totals[key]}
                max={TOTAL_BOUNDS[key]}
                required={key === "calories"}
                disabled={disabled}
                accent={ACCENT[key]}
                onChange={(value) => update({ totals: { ...draft.totals, [key]: value } })}
              />
            ))}
          </div>
        )}
        <MacroSplitBar macros={totals} />
      </section>

      <section aria-labelledby={`${idPrefix}-items-title`} className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 id={`${idPrefix}-items-title`} className="text-sm font-bold text-white">
            Ingredients {hasItems && <span className="text-zinc-400 font-medium">({draft.items.length})</span>}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {itemsToolbarSlot}
            <button
              type="button"
              disabled={disabled || draft.items.length >= MEAL_LIMITS.itemsMax}
              onClick={() => onChange(addItemToDraft(draft))}
              className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add ingredient
            </button>
          </div>
        </div>

        {hasItems ? (
          <ul className="space-y-2.5">
            {draft.items.map((item, index) => (
              <ItemEditor
                key={item.key}
                idPrefix={idPrefix}
                index={index}
                item={item}
                isNew={Boolean(newItemKeys?.has(item.key))}
                disabled={disabled}
                onChange={(next) =>
                  update({ items: draft.items.map((current) => (current.key === item.key ? next : current)) })
                }
                onRemove={() => onChange(removeItemFromDraft(draft, item.key))}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">
            Optional. Adding ingredients keeps the totals in sync automatically.
          </p>
        )}
      </section>

      <div>
        <label htmlFor={`${idPrefix}-notes`} className="block text-xs font-semibold text-zinc-300 mb-1">
          Your notes (optional)
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          value={draft.notes}
          maxLength={MEAL_LIMITS.notesMax}
          rows={2}
          disabled={disabled}
          placeholder="e.g. Cooked with 1 tbsp olive oil"
          onChange={(event) => update({ notes: event.target.value })}
          className={cn(inputClass, "resize-y")}
        />
      </div>
    </div>
  );
}

export default MealForm;
