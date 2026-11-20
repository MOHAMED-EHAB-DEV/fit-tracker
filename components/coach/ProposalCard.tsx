"use client";

import { useId, useState } from "react";
import { Check, Droplets, Footprints, Loader2, Scale, UtensilsCrossed, X, AlertCircle, Pencil } from "lucide-react";
import { addDays, formatDateString } from "@/lib/time";
import { describeProposal } from "@/lib/assistant/proposals";
import { logProposalSchema, LOG_LIMITS } from "@/lib/validation/assistant";
import { MEAL_TYPES, type LogProposal, type MealTypeId } from "@/lib/assistant/types";
import type { ProposalState } from "@/lib/assistant/chat-storage";

const MEAL_TYPE_LABEL: Record<MealTypeId, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  pre_workout: "Pre-workout",
  post_workout: "Post-workout",
};

const KIND_ICON = { meal: UtensilsCrossed, water: Droplets, steps: Footprints, weight: Scale } as const;
const KIND_LABEL = { meal: "Meal", water: "Water", steps: "Steps (day total)", weight: "Body weight" } as const;

interface ProposalCardProps {
  state: ProposalState;
  today: string;
  onChange: (proposal: LogProposal) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

const inputClass =
  "w-full min-h-11 px-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30";
const labelClass = "block text-xs font-medium text-zinc-400 mb-1";

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className={inputClass}
      />
    </div>
  );
}

export function ProposalCard({ state, today, onChange, onConfirm, onDismiss }: ProposalCardProps) {
  const ids = useId();
  const [isEditing, setIsEditing] = useState(false);
  const { proposal, status } = state;
  const Icon = KIND_ICON[proposal.kind];
  const validation = logProposalSchema.safeParse(proposal);
  const isBusy = status === "saving";
  const isFinal = status === "saved" || status === "dismissed";
  const minDate = addDays(today, -LOG_LIMITS.maxPastDays);
  const dateInvalid = proposal.date > today || proposal.date < minDate;

  if (status === "dismissed") {
    return (
      <p className="text-xs text-zinc-400 px-1">
        Not logged: {describeProposal(proposal)}
      </p>
    );
  }

  const set = (patch: Partial<LogProposal>) => onChange({ ...proposal, ...patch } as LogProposal);

  return (
    <div
      className={`rounded-2xl border p-3 space-y-3 text-sm ${
        status === "saved" ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-700 bg-zinc-950/70"
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{KIND_LABEL[proposal.kind]}</p>
          <p className="text-zinc-100 font-medium break-words">{describeProposal(proposal)}</p>
          <p className="text-xs text-zinc-400">
            {formatDateString(proposal.date, { weekday: "short", month: "short", day: "numeric" })}
            {proposal.kind === "meal" && ` · ${MEAL_TYPE_LABEL[proposal.mealType]}`}
            {proposal.kind === "meal" &&
              ` · C ${proposal.carbs} g · F ${proposal.fat} g${proposal.fiber ? ` · fibre ${proposal.fiber} g` : ""}`}
          </p>
        </div>
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 shrink-0">
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            Logged
          </span>
        )}
      </div>

      {isEditing && !isFinal && (
        <div className="grid grid-cols-2 gap-2">
          {proposal.kind === "meal" && (
            <>
              <div className="col-span-2">
                <label htmlFor={`${ids}-desc`} className={labelClass}>
                  Description
                </label>
                <input
                  id={`${ids}-desc`}
                  value={proposal.description}
                  maxLength={200}
                  onChange={(e) => set({ description: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`${ids}-type`} className={labelClass}>
                  Meal
                </label>
                <select
                  id={`${ids}-type`}
                  value={proposal.mealType}
                  onChange={(e) => set({ mealType: e.target.value as MealTypeId })}
                  className={inputClass}
                >
                  {MEAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEAL_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </div>
              <NumberField id={`${ids}-kcal`} label="Calories (kcal)" value={proposal.calories} min={0} max={LOG_LIMITS.calories} step={1} onChange={(v) => set({ calories: v })} />
              <NumberField id={`${ids}-p`} label="Protein (g)" value={proposal.protein} min={0} max={LOG_LIMITS.protein} step={0.1} onChange={(v) => set({ protein: v })} />
              <NumberField id={`${ids}-c`} label="Carbs (g)" value={proposal.carbs} min={0} max={LOG_LIMITS.carbs} step={0.1} onChange={(v) => set({ carbs: v })} />
              <NumberField id={`${ids}-f`} label="Fat (g)" value={proposal.fat} min={0} max={LOG_LIMITS.fat} step={0.1} onChange={(v) => set({ fat: v })} />
            </>
          )}
          {proposal.kind === "water" && (
            <NumberField id={`${ids}-ml`} label="Amount (ml)" value={proposal.amountMl} min={1} max={LOG_LIMITS.waterMl} step={50} onChange={(v) => set({ amountMl: v })} />
          )}
          {proposal.kind === "steps" && (
            <NumberField id={`${ids}-steps`} label="Steps for the day" value={proposal.count} min={0} max={LOG_LIMITS.steps} step={100} onChange={(v) => set({ count: v })} />
          )}
          {proposal.kind === "weight" && (
            <>
              <NumberField id={`${ids}-w`} label="Weight" value={proposal.weight} min={1} max={1000} step={0.1} onChange={(v) => set({ weight: v })} />
              <div>
                <label htmlFor={`${ids}-unit`} className={labelClass}>
                  Unit
                </label>
                <select
                  id={`${ids}-unit`}
                  value={proposal.unit}
                  onChange={(e) => set({ unit: e.target.value === "lbs" ? "lbs" : "kg" })}
                  className={inputClass}
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label htmlFor={`${ids}-date`} className={labelClass}>
              Date
            </label>
            <input
              id={`${ids}-date`}
              type="date"
              min={minDate}
              max={today}
              value={proposal.date}
              onChange={(e) => e.target.value && set({ date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {proposal.kind === "steps" && !isFinal && (
        <p className="text-xs text-zinc-400">This replaces the step total saved for that day.</p>
      )}

      {state.error && status === "error" && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {!isFinal && (!validation.success || dateInvalid) && (
        <p className="text-xs text-amber-300">
          {dateInvalid ? `Pick a date from ${formatDateString(minDate)} to today.` : "Check the values before logging."}
        </p>
      )}

      {!isFinal && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy || !validation.success || dateInvalid}
            className="inline-flex items-center gap-1.5 px-4 min-h-11 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
            {status === "error" ? "Try again" : "Log it"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            disabled={isBusy}
            aria-expanded={isEditing}
            className="inline-flex items-center gap-1.5 px-3 min-h-11 rounded-xl border border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
            {isEditing ? "Done editing" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isBusy}
            aria-label={`Don't log ${describeProposal(proposal)}`}
            className="inline-flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default ProposalCard;
