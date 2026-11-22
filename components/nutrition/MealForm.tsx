"use client";

import React, { useId, useState } from "react";
import { AlertCircle, ChevronDown, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
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

/** Protein / carbs / fat share of energy, in three ink tones; hidden when there is nothing to split. */
export function MacroSplitBar({ macros }: { macros: Partial<Macros> }) {
  const split = energySplit(macros);
  if (!split) return null;
  return (
    <div className="space-y-1.5">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-elevated"
        role="img"
        aria-label={`Energy from protein ${split.proteinPct}%, carbs ${split.carbsPct}%, fat ${split.fatPct}%`}
      >
        <div style={{ width: `${split.proteinPct}%` }} className="h-full bg-ink" />
        <div style={{ width: `${split.carbsPct}%` }} className="h-full bg-ink-3" />
        <div style={{ width: `${split.fatPct}%` }} className="h-full bg-line-strong" />
      </div>
      <p className="flex justify-between font-mono text-xs tabular-nums text-ink-3" aria-hidden="true">
        <span>
          <span className="me-1 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />P {split.proteinPct}%
        </span>
        <span>
          <span className="me-1 inline-block h-1.5 w-1.5 rounded-full bg-ink-3 align-middle" />C {split.carbsPct}%
        </span>
        <span>
          <span className="me-1 inline-block h-1.5 w-1.5 rounded-full bg-line-strong align-middle" />F {split.fatPct}%
        </span>
      </p>
    </div>
  );
}

function AmountInput({
  id,
  label,
  unit,
  value,
  onChange,
  max,
  disabled,
  required,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Input
      id={id}
      label={label}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value.replace(",", ".");
        if (/^\d*\.?\d*$/.test(next) && (next === "" || Number(next) <= max)) onChange(next);
      }}
      endContent={<span className="pe-1 text-xs text-ink-3">{unit}</span>}
      containerClassName="min-w-0"
      inputClassName="font-mono tabular-nums"
    />
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
    <li className={cn("space-y-2.5 rounded-control border bg-surface p-3", isNew ? "border-line-strong" : "border-line")}>
      <div className="flex items-end gap-2">
        <Input
          id={`${base}-name`}
          label={
            <span className="flex items-center gap-2">
              Ingredient {index + 1}
              {isNew && <span className="text-xs font-medium text-ink-3">· New</span>}
            </span>
          }
          type="text"
          value={item.name}
          maxLength={MEAL_LIMITS.itemNameMax}
          disabled={disabled}
          placeholder="Grilled chicken breast"
          onChange={(event) => onChange({ ...item, name: event.target.value })}
          containerClassName="min-w-0 flex-1"
        />
        <Input
          id={`${base}-qty`}
          label="Portion"
          type="text"
          value={item.quantity}
          maxLength={MEAL_LIMITS.quantityMax}
          disabled={disabled}
          placeholder="150 g"
          onChange={(event) => onChange({ ...item, quantity: event.target.value })}
          containerClassName="w-24 shrink-0 sm:w-32"
        />
        <IconButton label={`Remove ${label}`} icon={<Trash2 className="h-4 w-4" />} onClick={onRemove} disabled={disabled} className="mb-0.5" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {MACRO_KEYS.map((key) => (
          <AmountInput
            key={key}
            id={`${base}-${key}`}
            label={MACRO_LABELS[key]}
            unit={UNIT[key]}
            value={item[key]}
            max={ITEM_BOUNDS[key]}
            disabled={disabled}
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
  /** Keys of ingredients the AI just added (marked "New"). */
  newItemKeys?: ReadonlySet<string>;
  /** Start with "More details" open (editing, AI review). */
  defaultDetailsOpen?: boolean;
  /** Focus the name field when the form appears. */
  autoFocusName?: boolean;
}

/**
 * The one meal editor (add, edit, review an AI estimate): name, calories and
 * protein up front; "More details" holds carbs, fat, fibre, meal type, day
 * and time, ingredients and notes. With ingredients, totals are their sum.
 */
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
  defaultDetailsOpen = false,
  autoFocusName = false,
}: MealFormProps) {
  const detailsId = useId();
  const hasItems = draft.items.length > 0;
  const [detailsOpen, setDetailsOpen] = useState(
    defaultDetailsOpen || hasItems || Boolean(draft.notes.trim()) || Boolean(draft.totals.carbs || draft.totals.fat)
  );
  const totals = draftTotals(draft);
  const update = (patch: Partial<MealDraft>) => onChange({ ...draft, ...patch });
  const setTotal = (key: MacroKey, value: string) => update({ totals: { ...draft.totals, [key]: value } });

  return (
    <div className="space-y-3 text-start">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {headerSlot}

      <Input
        id={`${idPrefix}-description`}
        label="What did you eat?"
        type="text"
        value={draft.description}
        maxLength={MEAL_LIMITS.descriptionMax}
        disabled={disabled}
        placeholder="Chicken rice bowl"
        autoComplete="off"
        data-autofocus={autoFocusName ? true : undefined}
        onChange={(event) => update({ description: event.target.value })}
      />

      {hasItems ? (
        <div className="flex items-baseline justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2.5">
          <span className="text-xs text-ink-3">From the ingredients</span>
          <span className="font-mono text-sm font-medium tabular-nums text-ink">
            {formatAmount(totals.calories)} kcal · {formatAmount(totals.protein)} g protein
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AmountInput
            id={`${idPrefix}-total-calories`}
            label="Calories"
            unit="kcal"
            value={draft.totals.calories}
            max={TOTAL_BOUNDS.calories}
            required
            disabled={disabled}
            onChange={(value) => setTotal("calories", value)}
          />
          <AmountInput
            id={`${idPrefix}-total-protein`}
            label="Protein"
            unit="g"
            value={draft.totals.protein}
            max={TOTAL_BOUNDS.protein}
            disabled={disabled}
            onChange={(value) => setTotal("protein", value)}
          />
        </div>
      )}

      <button
        type="button"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen((open) => !open)}
        className="-mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center justify-between rounded-control px-1 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink cursor-pointer"
      >
        More details
        <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} aria-hidden="true" />
      </button>

      <div id={detailsId} hidden={!detailsOpen} className="space-y-4">
        {!hasItems && (
          <div className="grid grid-cols-3 gap-2">
            {(["carbs", "fat", "fiber"] as const).map((key) => (
              <AmountInput
                key={key}
                id={`${idPrefix}-total-${key}`}
                label={MACRO_LABELS[key]}
                unit={UNIT[key]}
                value={draft.totals[key]}
                max={TOTAL_BOUNDS[key]}
                disabled={disabled}
                onChange={(value) => setTotal(key, value)}
              />
            ))}
          </div>
        )}

        <MacroSplitBar macros={totals} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_0.8fr]">
          <Select<MealType>
            id={`${idPrefix}-type`}
            label="Meal"
            options={MEAL_TYPE_OPTIONS}
            value={draft.mealType}
            disabled={disabled}
            onChange={(value) => update({ mealType: value })}
          />
          <div className="grid grid-cols-[1.25fr_1fr] gap-3 sm:contents">
            <Input
              id={`${idPrefix}-date`}
              label="Day"
              type="date"
              value={draft.dateString}
              max={maxDate}
              min="2000-01-01"
              required
              disabled={disabled}
              onChange={(event) => update({ dateString: event.target.value })}
              inputClassName="font-mono tabular-nums"
            />
            <Input
              id={`${idPrefix}-time`}
              label="Time"
              type="time"
              value={draft.time}
              required
              disabled={disabled}
              onChange={(event) => update({ time: event.target.value })}
              inputClassName="font-mono tabular-nums"
            />
          </div>
        </div>

        <section aria-labelledby={`${idPrefix}-items-title`} className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${idPrefix}-items-title`} className="text-[13px] font-semibold text-ink-2">
              Ingredients{hasItems && <span className="font-mono font-normal text-ink-3"> {draft.items.length}</span>}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {itemsToolbarSlot}
              <button
                type="button"
                disabled={disabled || draft.items.length >= MEAL_LIMITS.itemsMax}
                onClick={() => onChange(addItemToDraft(draft))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-chip border border-line bg-elevated px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add ingredient
              </button>
            </div>
          </div>
          {hasItems ? (
            <ul className="space-y-2">
              {draft.items.map((item, index) => (
                <ItemEditor
                  key={item.key}
                  idPrefix={idPrefix}
                  index={index}
                  item={item}
                  isNew={Boolean(newItemKeys?.has(item.key))}
                  disabled={disabled}
                  onChange={(next) => update({ items: draft.items.map((current) => (current.key === item.key ? next : current)) })}
                  onRemove={() => onChange(removeItemFromDraft(draft, item.key))}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">Optional. With ingredients, the totals add up by themselves.</p>
          )}
        </section>

        <Textarea
          id={`${idPrefix}-notes`}
          label="Notes (optional)"
          value={draft.notes}
          maxLength={MEAL_LIMITS.notesMax}
          rows={2}
          disabled={disabled}
          placeholder="Cooked with 1 tbsp olive oil"
          onChange={(event) => update({ notes: event.target.value })}
        />
      </div>
    </div>
  );
}

export default MealForm;
