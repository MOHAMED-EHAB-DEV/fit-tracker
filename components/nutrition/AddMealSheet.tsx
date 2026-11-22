"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { SuggestedCard } from "@/components/ui/SuggestedCard";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { MealForm } from "@/components/nutrition/MealForm";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { useClientResize } from "@/hooks/useClientResize";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import { analyzePhotosRequest, createMealRequest, regenerateMealRequest, updateMealRequest } from "@/lib/nutrition/client";
import {
  applyProposalToDraft,
  draftFromMeal,
  draftItemsForPrompt,
  isDraftDirty,
  newMealDraft,
  validateDraft,
  type MealDraft,
} from "@/lib/nutrition/draft";
import { summarizeItemChanges, type MealProposal } from "@/lib/nutrition/analysis";
import { defaultMealTypeForHour, formatAmount } from "@/lib/nutrition/totals";
import { MEAL_LIMITS } from "@/lib/validation/nutrition";
import { addDays, formatDateString, localParts } from "@/lib/time";
import type { MealData } from "@/lib/nutrition/types";
import type { MealType } from "@/types/fitness";

export type AddMealMode = "manual" | "scan";

export interface AddMealSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The day being viewed: a new meal defaults to it (never later than today). */
  dateString: string;
  /** Start on Manual or Scan. */
  initialMode?: AddMealMode;
  /** Edit this saved meal instead of adding one. */
  meal?: MealData | null;
  /** After a successful save. */
  onSaved?: (meal: MealData) => void;
}

interface AttachedPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

interface ScanReview {
  proposal: MealProposal;
  token: string;
  warnings: string[];
  photosAnalyzed: number;
  draft: MealDraft;
}

interface AiRun {
  token: string;
  previous: MealDraft;
  summary: string;
  warnings: string[];
  newKeys: Set<string>;
}

const CONFIDENCE_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

function confidenceText(confidence?: string): string {
  return CONFIDENCE_LABEL[(confidence as keyof typeof CONFIDENCE_LABEL) ?? "medium"] ?? CONFIDENCE_LABEL.medium;
}

function describeChanges(changes: { added: string[]; removed: string[]; changed: string[] }): string {
  const parts: string[] = [];
  if (changes.added.length) parts.push(`added ${changes.added.join(", ")}`);
  if (changes.removed.length) parts.push(`removed ${changes.removed.join(", ")}`);
  if (changes.changed.length) parts.push(`updated ${changes.changed.join(", ")}`);
  return parts.length ? `The AI ${parts.join("; ")}.` : "The AI kept the same ingredients.";
}

function dayName(dateString: string, today: string): string {
  if (dateString === today) return "today";
  if (dateString === addDays(today, -1)) return "yesterday";
  return formatDateString(dateString);
}

/**
 * Log, scan or edit a meal in one sheet. Manual: name, calories, protein and
 * "More details". Scan: photos and a note, then the AI estimate waits in a
 * Suggested container (Accept saves it, Edit opens it in the form, Dismiss
 * drops it). Edit: the same form for a saved meal, with "Regenerate with AI".
 * Closing with unsaved work asks first.
 */
export function AddMealSheet({ isOpen, onClose, dateString, initialMode = "manual", meal = null, onSaved }: AddMealSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tz = useUserTimeZone();
  const { resizeImages, isResizing } = useClientResize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const photosRef = useRef<AttachedPhoto[]>([]);

  const isEdit = Boolean(meal);
  const [today, setToday] = useState(() => todayInZone(tz));
  const startDay = dateString > today ? today : dateString;
  const [mode, setMode] = useState<AddMealMode>(initialMode);
  const [initial, setInitial] = useState<MealDraft>(() => (meal ? draftFromMeal(meal, tz) : newMealDraft(startDay, tz)));
  const [draft, setDraft] = useState<MealDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Scan
  const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
  const [scanNote, setScanNote] = useState("");
  const [scanType, setScanType] = useState<MealType>(() => defaultMealTypeForHour(localParts(new Date(), tz).hour));
  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<ScanReview | null>(null);
  const [editingReview, setEditingReview] = useState(false);

  // Edit: AI regenerate
  const [regenerating, setRegenerating] = useState(false);
  const [aiRun, setAiRun] = useState<AiRun | null>(null);

  // Every opening starts fresh (a different meal, mode or day).
  const [openKey, setOpenKey] = useState<string | null>(null);
  const key = isOpen ? `${meal?._id ?? "new"}:${initialMode}:${dateString}` : null;
  if (key !== openKey) {
    setOpenKey(key);
    if (key) {
      const now = todayInZone(tz);
      const fresh = meal ? draftFromMeal(meal, tz) : newMealDraft(dateString > now ? now : dateString, tz);
      setToday(now);
      setMode(initialMode);
      setInitial(fresh);
      setDraft(fresh);
      setError(null);
      setSaving(false);
      setConfirmingDiscard(false);
      setPhotos([]);
      setScanNote("");
      setScanType(fresh.mealType);
      setReview(null);
      setEditingReview(false);
      setAiRun(null);
    }
  }

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Photo previews are released when the sheet goes away.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    []
  );

  const releasePhotos = () => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    photosRef.current = [];
  };

  const scanActive = !isEdit && mode === "scan";
  const showForm = !scanActive || editingReview;
  const formDraft = scanActive && review ? review.draft : draft;
  const setFormDraft = (next: MealDraft) => {
    if (scanActive && review) setReview({ ...review, draft: next });
    else setDraft(next);
  };

  const dirty =
    isDraftDirty(initial, draft) || photos.length > 0 || Boolean(scanNote.trim()) || review !== null || aiRun !== null;
  const locked = saving || analyzing || regenerating;

  const close = () => {
    abortRef.current?.abort();
    releasePhotos();
    setPhotos([]);
    setConfirmingDiscard(false);
    onClose();
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    close();
  };

  const afterSave = (saved: MealData, message: string) => {
    toast(message, "success");
    onSaved?.(saved);
    const savedDay = saved.dateString ?? dateString;
    close();
    if (savedDay !== dateString) {
      router.push(savedDay === todayInZone(tz) ? "/nutrition" : `/nutrition?date=${savedDay}`);
    }
    router.refresh();
  };

  const saveDraft = async (source: MealDraft, options: { photos?: Blob[]; aiProposal?: string | null } = {}) => {
    if (busyRef.current) return;
    const now = todayInZone(tz);
    const checked = validateDraft(source, now);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (meal) {
        const saved = await updateMealRequest(meal._id, checked.payload, { aiProposal: options.aiProposal });
        afterSave(saved, "Meal updated");
      } else {
        const saved = await createMealRequest(checked.payload, options);
        const day = checked.payload.dateString;
        afterSave(saved, day === dateString ? "Meal logged" : `Meal logged to ${dayName(day, now)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The meal could not be saved. Please try again.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const submit = () => {
    if (scanActive && review) void saveDraft(review.draft, { photos: photos.map((photo) => photo.blob), aiProposal: review.token });
    else void saveDraft(draft, { aiProposal: aiRun?.token ?? null });
  };

  // ----- Scan -----

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setError(null);
    const room = MEAL_LIMITS.photosMax - photos.length;
    if (room <= 0) {
      setError(`You can attach up to ${MEAL_LIMITS.photosMax} photos.`);
      return;
    }
    try {
      const blobs = await resizeImages(files.slice(0, room), { maxDimension: 1024, quality: 0.82 });
      const added = blobs.map((blob, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        blob,
        previewUrl: URL.createObjectURL(blob),
      }));
      setPhotos((prev) => [...prev, ...added]);
      // A new photo makes an earlier estimate out of date.
      setReview(null);
      setEditingReview(false);
      if (files.length > room) setError(`Only ${MEAL_LIMITS.photosMax} photos can be attached; the rest were skipped.`);
    } catch {
      setError("That photo could not be read. Try a JPEG or PNG photo.");
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((photo) => photo.id !== id);
    });
    setReview(null);
    setEditingReview(false);
  };

  const analyze = async () => {
    if (busyRef.current) return;
    if (photos.length === 0 && !scanNote.trim()) {
      setError("Add a photo or describe the meal first.");
      return;
    }
    busyRef.current = true;
    setAnalyzing(true);
    setError(null);
    setReview(null);
    setEditingReview(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const day = initial.dateString;
    try {
      const result = await analyzePhotosRequest(
        { photos: photos.map((photo) => photo.blob), description: scanNote.trim(), mealType: scanType, dateString: day },
        controller.signal
      );
      const base = { ...newMealDraft(day, tz), mealType: scanType };
      setReview({
        proposal: result.proposal,
        token: result.proposalToken,
        warnings: result.warnings,
        photosAnalyzed: result.photosAnalyzed,
        draft: applyProposalToDraft(base, result.proposal),
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "The meal could not be analysed. Please try again.");
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  };

  // ----- Edit: regenerate with AI -----

  const regenerate = async () => {
    if (!meal || busyRef.current) return;
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
        { mealId: meal._id, description: draft.description.trim(), mealType: draft.mealType, currentItems },
        controller.signal
      );
      const next = applyProposalToDraft(draft, result.proposal);
      const newKeys = new Set(
        next.items.filter((_, index) => result.proposal.items[index]?.fromCurrent === null).map((item) => item.key)
      );
      setAiRun({
        token: result.proposalToken,
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

  // ----- Pieces -----

  const photoStrip = photos.length > 0 && (
    <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Meal photos">
      {photos.map((photo, index) => (
        <li key={photo.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border border-line bg-elevated">
          <Image src={photo.previewUrl} alt={`Meal photo ${index + 1}`} fill sizes="80px" className="object-cover" unoptimized />
          {!review && (
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              disabled={locked}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute end-1 top-1 grid h-8 w-8 place-items-center rounded-chip bg-canvas/85 text-ink-2 transition-colors hover:text-danger disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
      {!review && photos.length < MEAL_LIMITS.photosMax && (
        <li>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={locked || isResizing}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-control border border-dashed border-line-strong text-xs font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </button>
        </li>
      )}
    </ul>
  );

  const scanStep = (
    <div className="space-y-3">
      {error && !review && (
        <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFiles}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        aria-label="Choose meal photos"
        className="hidden"
      />
      {photos.length === 0 ? (
        !review && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={locked || isResizing}
          className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-4 py-6 text-center transition-colors hover:bg-elevated/40 disabled:opacity-50 cursor-pointer"
        >
          <span className="grid h-10 w-10 place-items-center rounded-control border border-line bg-elevated text-ink-2" aria-hidden="true">
            <Camera className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-ink">{isResizing ? "Preparing photos…" : "Take or choose photos"}</span>
          <span className="text-xs text-ink-3">Up to {MEAL_LIMITS.photosMax}: the plate, sides or a nutrition label.</span>
        </button>
        )
      ) : (
        photoStrip
      )}

      {!review && (
        <>
          <Select<MealType>
            id="scan-meal-type"
            label="Meal"
            options={MEAL_TYPE_OPTIONS}
            value={scanType}
            disabled={locked}
            onChange={setScanType}
          />
          <Textarea
            id="scan-note"
            label="Anything the photo cannot show (optional)"
            description="Weights, oils and sauces make the estimate more accurate."
            rows={2}
            maxLength={MEAL_LIMITS.aiDescriptionMax}
            value={scanNote}
            disabled={locked}
            onChange={(event) => setScanNote(event.target.value)}
            placeholder="200 g chicken, 1 cup rice, 1 tbsp olive oil"
          />
        </>
      )}

      {(analyzing || review) && (
        <SuggestedCard
          meta={review ? confidenceText(review.proposal.confidence) : "Photo scan"}
          isLoading={analyzing}
          acceptLabel="Accept"
          isAccepting={saving}
          onAccept={review ? submit : undefined}
          onDismiss={
            review
              ? () => {
                  setReview(null);
                  setEditingReview(false);
                  setError(null);
                }
              : undefined
          }
        >
          {review && (
            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold text-ink">{review.draft.description || review.proposal.mealDescription}</p>
              <p className="font-mono text-xs tabular-nums text-ink-2">
                {formatAmount(review.proposal.totals.calories)} kcal · {formatAmount(review.proposal.totals.protein)} g P ·{" "}
                {formatAmount(review.proposal.totals.carbs)} g C · {formatAmount(review.proposal.totals.fat)} g F
              </p>
              {review.proposal.confidenceReason && <p className="text-xs leading-5 text-ink-3">{review.proposal.confidenceReason}</p>}
              {review.warnings.map((warning) => (
                <p key={warning} className="flex items-start gap-1.5 text-xs leading-5 text-warn">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {warning}
                </p>
              ))}
              {error && (
                <p role="alert" className="text-xs text-danger">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => setEditingReview(true)}
                className="-mx-1 min-h-9 rounded-chip px-1 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink cursor-pointer"
              >
                Edit before saving
              </button>
            </div>
          )}
        </SuggestedCard>
      )}
    </div>
  );

  const aiHeader = isEdit && meal && (
    <div className="space-y-2">
      {(meal.images?.length ?? 0) > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(meal.images ?? []).map((image, index) => (
            <div key={image.secureUrl} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control border border-line bg-elevated">
              <Image src={image.secureUrl} alt={`${meal.description || "Meal"} photo ${index + 1}`} fill sizes="64px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
      {aiRun ? (
        <div role="status" className="space-y-1.5 rounded-control border border-dashed border-line-strong bg-surface px-3 py-2.5">
          <p className="text-[13px] leading-5 text-ink">{aiRun.summary} Check the numbers, then save.</p>
          {aiRun.warnings.map((warning) => (
            <p key={warning} className="text-xs text-warn">
              {warning}
            </p>
          ))}
          <Button
            variant="ghost"
            size="sm"
            startContent={<Undo2 className="h-3.5 w-3.5" />}
            onClick={() => {
              setDraft(aiRun.previous);
              setAiRun(null);
            }}
          >
            Undo AI changes
          </Button>
        </div>
      ) : (
        meal.aiMacros && (
          <p className="text-xs leading-5 text-ink-3">
            <Sparkles className="me-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
            AI estimate ({confidenceText(meal.aiMacros.confidence).toLowerCase()})
            {meal.isManualOverride ? ", adjusted by you" : ""}.
            {meal.aiMacros.geminiNotes ? ` ${meal.aiMacros.geminiNotes}` : ""}
          </p>
        )
      )}
    </div>
  );

  const regenerateButton = isEdit && (
    <button
      type="button"
      onClick={() => void regenerate()}
      disabled={locked}
      aria-busy={regenerating}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-chip border border-dashed border-line-strong px-3 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50 cursor-pointer"
    >
      <Sparkles className={regenerating ? "h-4 w-4 animate-pulse" : "h-4 w-4"} aria-hidden="true" />
      {regenerating ? "Asking the AI…" : "Regenerate with AI"}
    </button>
  );

  const form = (
    <form
      id="meal-sheet-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked) submit();
      }}
    >
      <MealForm
        key={scanActive ? "review" : "manual"}
        idPrefix={isEdit ? `edit-meal-${meal?._id}` : scanActive ? "review-meal" : "add-meal"}
        draft={formDraft}
        onChange={setFormDraft}
        maxDate={today}
        disabled={locked}
        error={error}
        headerSlot={scanActive ? photoStrip : aiHeader}
        itemsToolbarSlot={regenerateButton}
        newItemKeys={aiRun?.newKeys}
        defaultDetailsOpen={isEdit || scanActive}
        autoFocusName={!isEdit && !scanActive}
      />
    </form>
  );

  const footer = confirmingDiscard ? (
    <div role="alertdialog" aria-label="Unsaved changes" className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-ink-2">{isEdit ? "Discard your changes?" : "Discard this meal?"}</span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="secondary" onClick={() => setConfirmingDiscard(false)} autoFocus>
          Keep editing
        </Button>
        <Button variant="danger" onClick={close}>
          Discard
        </Button>
      </div>
    </div>
  ) : scanActive && !editingReview ? (
    review ? undefined : (
      <Button
        fullWidth
        size="lg"
        startContent={analyzing ? undefined : <Sparkles className="h-4 w-4" />}
        isLoading={analyzing}
        disabled={locked || isResizing || (photos.length === 0 && !scanNote.trim())}
        onClick={() => void analyze()}
      >
        {analyzing ? "Estimating…" : "Estimate with AI"}
      </Button>
    )
  ) : (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button variant="secondary" onClick={scanActive ? () => setEditingReview(false) : requestClose} disabled={saving}>
        {scanActive ? "Back" : "Cancel"}
      </Button>
      <Button type="submit" form="meal-sheet-form" isLoading={saving} disabled={locked}>
        {isEdit ? "Save changes" : "Save meal"}
      </Button>
    </div>
  );

  const title = isEdit ? "Edit meal" : "Log meal";
  const description = isEdit
    ? undefined
    : `For ${dayName(scanActive && review ? review.draft.dateString : draft.dateString, today)}`;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={requestClose}
      title={title}
      description={description}
      size="lg"
      closeOnBackdropClick={!dirty}
      footer={footer}
    >
      <div className="space-y-4">
        {!isEdit && (
          <SegmentedControl<AddMealMode>
            label="How to log the meal"
            value={mode}
            options={[
              { value: "manual", label: "Manual" },
              { value: "scan", label: "Scan" },
            ]}
            onChange={(next) => {
              setMode(next);
              setError(null);
              setConfirmingDiscard(false);
            }}
            disabled={locked}
            className="w-full"
          />
        )}
        {showForm ? form : scanStep}
      </div>
    </Sheet>
  );
}

export default AddMealSheet;
