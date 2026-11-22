"use client";

import { useId, useState } from "react";
import { Check, Droplets, Footprints, Scale, Sparkles, UtensilsCrossed, X, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { addDays, formatDateString } from "@/lib/time";
import { describeProposal } from "@/lib/assistant/proposals";
import { logProposalSchema, LOG_LIMITS } from "@/lib/validation/assistant";
import { MEAL_TYPES, type LogProposal, type MealTypeId } from "@/lib/assistant/types";
import type { ProposalState } from "@/lib/assistant/chat-storage";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";

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

const MEAL_TYPE_OPTIONS: SelectOption<MealTypeId>[] = MEAL_TYPES.map((type) => ({ value: type, label: MEAL_TYPE_LABEL[type] }));
const UNIT_OPTIONS: SelectOption<"kg" | "lbs">[] = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
];

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
    <Input
      id={id}
      label={label}
      size="sm"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
    />
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
      <p className="px-1 text-xs text-ink-3">
        Not logged: {describeProposal(proposal)}
      </p>
    );
  }

  const set = (patch: Partial<LogProposal>) => onChange({ ...proposal, ...patch } as LogProposal);

  return (
    <div
      className={`space-y-2.5 rounded-card border-[1.5px] border-dashed bg-surface px-3.5 py-3 text-sm ${
        status === "saved" ? "border-line" : "border-line-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-line bg-elevated px-2 text-xs font-medium text-ink-2">
          {status === "saved" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          {status === "saved" ? "Logged" : "Suggested"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {KIND_LABEL[proposal.kind]}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-ink">{describeProposal(proposal)}</p>
          <p className="text-xs text-ink-3">
            {formatDateString(proposal.date, { weekday: "short", month: "short", day: "numeric" })}
            {proposal.kind === "meal" && ` · ${MEAL_TYPE_LABEL[proposal.mealType]}`}
            {proposal.kind === "meal" &&
              ` · C ${proposal.carbs} g · F ${proposal.fat} g${proposal.fiber ? ` · fibre ${proposal.fiber} g` : ""}`}
          </p>
        </div>
      </div>

      {isEditing && !isFinal && (
        <div className="grid grid-cols-2 gap-2">
          {proposal.kind === "meal" && (
            <>
              <Input
                id={`${ids}-desc`}
                label="Description"
                size="sm"
                value={proposal.description}
                maxLength={200}
                onChange={(e) => set({ description: e.target.value })}
                containerClassName="col-span-2"
              />
              <Select<MealTypeId>
                id={`${ids}-type`}
                label="Meal"
                size="sm"
                options={MEAL_TYPE_OPTIONS}
                value={proposal.mealType}
                onChange={(mealType) => set({ mealType })}
                className="col-span-2 sm:col-span-1"
              />
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
              <Select<"kg" | "lbs">
                id={`${ids}-unit`}
                label="Unit"
                size="sm"
                options={UNIT_OPTIONS}
                value={proposal.unit}
                onChange={(unit) => set({ unit })}
              />
            </>
          )}
          <Input
            id={`${ids}-date`}
            label="Date"
            size="sm"
            type="date"
            min={minDate}
            max={today}
            value={proposal.date}
            isInvalid={dateInvalid}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
          />
        </div>
      )}

      {proposal.kind === "steps" && !isFinal && (
        <p className="text-xs text-ink-3">This replaces the step total saved for that day.</p>
      )}

      {state.error && status === "error" && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {!isFinal && (!validation.success || dateInvalid) && (
        <p className="text-xs text-warn">
          {dateInvalid ? `Pick a date from ${formatDateString(minDate)} to today.` : "Check the values before logging."}
        </p>
      )}

      {!isFinal && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button
            size="sm"
            onClick={onConfirm}
            isLoading={isBusy}
            disabled={isBusy || !validation.success || dateInvalid}
            startContent={isBusy ? undefined : <Check className="h-3.5 w-3.5" />}
          >
            {status === "error" ? "Try again" : "Log it"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing((value) => !value)}
            disabled={isBusy}
            aria-expanded={isEditing}
            startContent={<Pencil className="h-3.5 w-3.5" />}
          >
            {isEditing ? "Done" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            disabled={isBusy}
            aria-label={`Don't log ${describeProposal(proposal)}`}
            startContent={<X className="h-3.5 w-3.5" />}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

export default ProposalCard;
