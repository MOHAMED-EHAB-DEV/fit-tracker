"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Edit3, Info, Sparkles, Undo2, Utensils } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { MealFormDialog } from "@/components/nutrition/MealFormDialog";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import {
  applyProposalToDraft,
  draftFromMeal,
  draftItemsForPrompt,
  validateDraft,
  type MealDraft,
} from "@/lib/nutrition/draft";
import { regenerateMealRequest, updateMealRequest } from "@/lib/nutrition/client";
import { summarizeItemChanges, type MealProposal } from "@/lib/nutrition/analysis";
import { MEAL_TYPE_LABELS } from "@/constants/nutrition";
import { formatAmount } from "@/lib/nutrition/totals";
import type { MealData } from "@/lib/nutrition/types";

export type { MealData, MealItem } from "@/lib/nutrition/types";

interface EditMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  meal: MealData | null;
  /** Called once after a successful save, with the saved meal. */
  onSaved?: (meal: MealData) => void;
}

interface AiRun {
  token: string;
  proposal: MealProposal;
  previous: MealDraft;
  summary: string;
  warnings: string[];
  newKeys: Set<string>;
}

function describeChanges(changes: { added: string[]; removed: string[]; changed: string[] }): string {
  const parts: string[] = [];
  if (changes.added.length) parts.push(`added ${changes.added.join(", ")}`);
  if (changes.removed.length) parts.push(`removed ${changes.removed.join(", ")}`);
  if (changes.changed.length) parts.push(`updated ${changes.changed.join(", ")}`);
  return parts.length ? `AI ${parts.join("; ")}.` : "AI kept the same ingredients.";
}

function confidenceLabel(confidence?: string): string {
  if (confidence === "high") return "High confidence";
  if (confidence === "low") return "Low confidence";
  return "Medium confidence";
}

export function EditMealModal({ isOpen, onClose, meal, onSaved }: EditMealModalProps) {
  const tz = useUserTimeZone();
  const { toast } = useToast();
  const [initial, setInitial] = useState<MealDraft | null>(() => (meal ? draftFromMeal(meal, tz) : null));
  const [draft, setDraft] = useState<MealDraft | null>(initial);
  const [today] = useState(() => todayInZone(tz));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [aiRun, setAiRun] = useState<AiRun | null>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // A different meal opened in the same instance: start over from it.
  const [mealId, setMealId] = useState(meal?._id);
  if (meal && meal._id !== mealId) {
    const fresh = draftFromMeal(meal, tz);
    setMealId(meal._id);
    setInitial(fresh);
    setDraft(fresh);
    setAiRun(null);
    setError(null);
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!meal || !draft || !initial) return null;

  const regenerate = async () => {
    if (busyRef.current) return;
    const currentItems = draftItemsForPrompt(draft);
    const hasPhoto = (meal.images?.length || 0) > 0;
    if (!hasPhoto && !draft.description.trim() && currentItems.length === 0) {
      setError("Describe the meal first so the AI has something to work with.");
      return;
    }
    busyRef.current = true;
    setRegenerating(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await regenerateMealRequest(
        {
          mealId: meal._id,
          description: draft.description.trim(),
          mealType: draft.mealType,
          currentItems,
        },
        controller.signal
      );
      const next = applyProposalToDraft(draft, result.proposal);
      const newKeys = new Set(
        next.items.filter((_, index) => result.proposal.items[index]?.fromCurrent === null).map((item) => item.key)
      );
      setAiRun({
        token: result.proposalToken,
        proposal: result.proposal,
        previous: draft,
        summary: describeChanges(summarizeItemChanges(currentItems, result.proposal.items)),
        warnings: result.warnings,
        newKeys,
      });
      setDraft(next);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "The AI could not update this meal. Please try again.");
    } finally {
      busyRef.current = false;
      setRegenerating(false);
    }
  };

  const undoAi = () => {
    if (!aiRun) return;
    setDraft(aiRun.previous);
    setAiRun(null);
  };

  const save = async () => {
    if (busyRef.current) return;
    const checked = validateDraft(draft, todayInZone(tz));
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await updateMealRequest(meal._id, checked.payload, { aiProposal: aiRun?.token });
      toast("Meal updated", "success");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The meal could not be saved. Please try again.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const shownAi = aiRun
    ? { ...aiRun.proposal.totals, confidence: aiRun.proposal.confidence, geminiNotes: aiRun.proposal.geminiNotes, confidenceReason: aiRun.proposal.confidenceReason }
    : meal.aiMacros;
  const photo = meal.images?.[0]?.secureUrl;

  const header = (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {photo ? (
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-zinc-900">
            <Image src={photo} alt={meal.description || "Meal photo"} fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
            <Utensils className="w-6 h-6 text-zinc-400" aria-hidden="true" />
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {MEAL_TYPE_LABELS[meal.mealType]}
          </span>
          {meal.aiMacros || aiRun ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> AI estimate
            </span>
          ) : (
            <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-white/10">Entered by you</span>
          )}
          {meal.isManualOverride && !aiRun && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" /> Adjusted by you
            </span>
          )}
          {(meal.images?.length || 0) > 1 && (
            <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-white/10">
              {meal.images?.length} photos
            </span>
          )}
        </div>
      </div>

      {aiRun && (
        <div role="status" className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2">
          <p className="text-sm text-teal-100">{aiRun.summary} Review the numbers, then save.</p>
          {aiRun.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-300">
              {warning}
            </p>
          ))}
          <button
            type="button"
            onClick={undoAi}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-zinc-900 border border-white/10 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" /> Undo AI changes
          </button>
        </div>
      )}

      {shownAi && (shownAi.geminiNotes || shownAi.confidenceReason || typeof shownAi.calories === "number") && (
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-teal-300 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" aria-hidden="true" /> AI assessment
            </span>
            {shownAi.confidence && <span className="text-xs text-zinc-300">{confidenceLabel(shownAi.confidence)}</span>}
          </div>
          {typeof shownAi.calories === "number" && (
            <p className="text-xs text-zinc-400 tabular-nums">
              AI estimate: {formatAmount(shownAi.calories)} kcal, P {formatAmount(shownAi.protein || 0)} g, C{" "}
              {formatAmount(shownAi.carbs || 0)} g, F {formatAmount(shownAi.fat || 0)} g
            </p>
          )}
          {shownAi.geminiNotes && <p className="text-sm text-zinc-300">{shownAi.geminiNotes}</p>}
          {shownAi.confidenceReason && <p className="text-xs text-zinc-400">{shownAi.confidenceReason}</p>}
        </div>
      )}
    </div>
  );

  const regenerateButton = (
    <button
      type="button"
      onClick={regenerate}
      disabled={regenerating || saving}
      aria-busy={regenerating}
      className="inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-200 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
    >
      <Sparkles className={regenerating ? "w-4 h-4 animate-pulse" : "w-4 h-4"} aria-hidden="true" />
      {regenerating ? "Asking AI..." : "Regenerate with AI"}
    </button>
  );

  return (
    <MealFormDialog
      isOpen={isOpen}
      idPrefix={`edit-meal-${meal._id}`}
      title="Edit meal"
      description="Change what you ate, when, and the numbers. Regenerate asks the AI to re-check it using your text and photo."
      initialDraft={initial}
      draft={draft}
      onChange={setDraft}
      maxDate={today}
      error={error}
      submitLabel="Save changes"
      isSaving={saving}
      isBusy={regenerating}
      forceDirty={Boolean(aiRun)}
      headerSlot={header}
      itemsToolbarSlot={regenerateButton}
      newItemKeys={aiRun?.newKeys}
      onSubmit={save}
      onClose={() => {
        abortRef.current?.abort();
        onClose();
      }}
    />
  );
}

export default EditMealModal;
