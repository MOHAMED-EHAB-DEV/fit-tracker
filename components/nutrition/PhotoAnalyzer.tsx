"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  Info,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { MEAL_TYPE_OPTIONS } from "@/constants/nutrition";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MealFormDialog } from "@/components/nutrition/MealFormDialog";
import { MacroSplitBar } from "@/components/nutrition/MealForm";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { analyzePhotosRequest, createMealRequest } from "@/lib/nutrition/client";
import { applyProposalToDraft, newMealDraft, validateDraft, type MealDraft } from "@/lib/nutrition/draft";
import { defaultMealTypeForHour, formatAmount } from "@/lib/nutrition/totals";
import { MEAL_LIMITS } from "@/lib/validation/nutrition";
import { addDays, formatDateString, isValidDateString, localParts } from "@/lib/time";
import type { MealProposal } from "@/lib/nutrition/analysis";
import type { MealData } from "@/lib/nutrition/types";
import type { MealType } from "@/types/fitness";
import { cn } from "@/lib/utils";

interface AttachedPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

interface Review {
  proposal: MealProposal;
  token: string;
  warnings: string[];
  photosAnalyzed: number;
  draft: MealDraft;
  /** Photo ids the analysis was run on (to spot later changes). */
  photoIds: string[];
}

function dayLabel(dateString: string, today: string): string {
  if (dateString === today) return "today";
  if (dateString === addDays(today, -1)) return "yesterday";
  return formatDateString(dateString, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function ConfidenceChip({ confidence }: { confidence: string }) {
  if (confidence === "high") {
    return (
      <Chip color="success" variant="flat" size="md" startContent={<ShieldCheck className="w-4 h-4" />}>
        High confidence
      </Chip>
    );
  }
  if (confidence === "low") {
    return (
      <Chip color="danger" variant="flat" size="md" startContent={<AlertCircle className="w-4 h-4" />}>
        Low confidence
      </Chip>
    );
  }
  return (
    <Chip color="warning" variant="flat" size="md" startContent={<AlertTriangle className="w-4 h-4" />}>
      Medium confidence
    </Chip>
  );
}

export function PhotoAnalyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tz = useUserTimeZone();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resizeImages, isResizing } = useClientResize();

  const [today, setToday] = useState(() => todayInZone(tz));
  const [dateString] = useState(() => {
    const requested = searchParams.get("date");
    const now = todayInZone(tz);
    return requested && isValidDateString(requested) && requested <= now ? requested : now;
  });
  const [photos, setPhotos] = useState<AttachedPhoto[]>([]);
  const [mealType, setMealType] = useState<MealType>(() => defaultMealTypeForHour(localParts(new Date(), tz).hour));
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [review, setReview] = useState<Review | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<MealData | null>(null);

  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const photosRef = useRef<AttachedPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Revoke preview URLs only when the page goes away (removed photos are revoked on removal).
  useEffect(
    () => () => {
      abortRef.current?.abort();
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    []
  );

  const photosChanged =
    review !== null &&
    (review.photoIds.length !== photos.length || review.photoIds.some((id, index) => photos[index]?.id !== id));

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
    const accepted = files.slice(0, room);
    try {
      const blobs = await resizeImages(accepted, { maxDimension: 1024, quality: 0.82 });
      const added = blobs.map((blob, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        blob,
        previewUrl: URL.createObjectURL(blob),
      }));
      setPhotos((prev) => [...prev, ...added]);
      if (files.length > room) setError(`Only ${MEAL_LIMITS.photosMax} photos can be attached; the rest were skipped.`);
    } catch {
      setError("That photo couldn't be read. Try a JPEG or PNG photo.");
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((photo) => photo.id !== id);
    });
  };

  const analyze = async () => {
    if (busyRef.current) return;
    if (photos.length === 0 && !description.trim()) {
      setError("Attach a photo or describe the meal first.");
      return;
    }
    busyRef.current = true;
    setAnalyzing(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await analyzePhotosRequest(
        { photos: photos.map((photo) => photo.blob), description: description.trim(), mealType, dateString },
        controller.signal
      );
      const base = { ...newMealDraft(dateString, tz), mealType };
      // A fresh analysis always starts from scratch: earlier results are never mixed in.
      setReview({
        proposal: result.proposal,
        token: result.proposalToken,
        warnings: result.warnings,
        photosAnalyzed: result.photosAnalyzed,
        draft: applyProposalToDraft(base, result.proposal),
        photoIds: photos.map((photo) => photo.id),
      });
      setReviewError(null);
      setToday(todayInZone(tz));
      setReviewOpen(true);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "The meal could not be analyzed. Please try again.");
    } finally {
      busyRef.current = false;
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!review || busyRef.current) return;
    if (photosChanged) {
      setReviewError("The photos changed after this analysis. Close this, then analyze again.");
      return;
    }
    const checked = validateDraft(review.draft, todayInZone(tz));
    if (!checked.ok) {
      setReviewError(checked.error);
      return;
    }
    busyRef.current = true;
    setSaving(true);
    setReviewError(null);
    try {
      const meal = await createMealRequest(checked.payload, {
        photos: photos.map((photo) => photo.blob),
        aiProposal: review.token,
      });
      setSaved(meal);
      setReviewOpen(false);
      router.refresh();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "The meal could not be saved. Please try again.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const reset = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setDescription("");
    setReview(null);
    setSaved(null);
    setError(null);
    setReviewError(null);
    setMealType(defaultMealTypeForHour(localParts(new Date(), tz).hour));
  };

  const savedDay = saved?.dateString || dateString;
  const nowToday = today;
  const viewDayHref = savedDay === nowToday ? "/nutrition" : `/nutrition?date=${savedDay}`;

  if (saved) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card variant="bordered" className="border-emerald-500/40 space-y-5">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-base" role="status">
              <Check className="w-5 h-5" aria-hidden="true" />
              <span>Meal saved to {dayLabel(savedDay, nowToday)}</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 pt-0">
            <p className="font-bold text-lg text-white">{saved.description}</p>
            {photos.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-zinc-950">
                    <Image src={photo.previewUrl} alt={`Saved photo ${index + 1}`} fill sizes="64px" className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["Calories", saved.macros.calories, "kcal", "text-white"],
                  ["Protein", saved.macros.protein, "g", "text-emerald-300"],
                  ["Carbs", saved.macros.carbs, "g", "text-amber-300"],
                  ["Fat", saved.macros.fat, "g", "text-rose-300"],
                ] as const
              ).map(([label, value, unit, color]) => (
                <div key={label} className="p-3 rounded-2xl bg-zinc-950/80 border border-white/10">
                  <dt className="text-xs text-zinc-400 font-semibold">{label}</dt>
                  <dd className={cn("text-lg font-bold tabular-nums", color)}>
                    {formatAmount(value)}
                    <span className="text-xs text-zinc-400 ms-0.5">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-2">
              {fromDashboard ? (
                <Button type="button" variant="solid" size="md" className="flex-1" onClick={() => router.push("/")}>
                  Back to dashboard
                </Button>
              ) : (
                <Button type="button" variant="solid" size="md" className="flex-1" onClick={() => router.push(viewDayHref)}>
                  View {dayLabel(savedDay, nowToday)}&apos;s meals
                </Button>
              )}
              <Button type="button" variant="bordered" size="md" onClick={reset}>
                Log another meal
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card variant="default" className="space-y-6">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">AI meal estimate</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Logging to <strong className="text-zinc-200">{dayLabel(dateString, today)}</strong>. You review
                everything before it is saved.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-6 pt-0">
          {error && (
            <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="font-medium">{error}</span>
            </div>
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

          {photos.length > 0 ? (
            <div className="space-y-3">
              <span className="block text-sm font-semibold text-zinc-300">
                Photos ({photos.length}/{MEAL_LIMITS.photosMax})
              </span>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <li key={photo.id} className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 aspect-4/3">
                    <Image src={photo.previewUrl} alt={`Meal photo ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      disabled={analyzing}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute top-1.5 inset-e-1.5 w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-950/85 border border-white/10 text-zinc-200 hover:text-red-300 transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {photos.length < MEAL_LIMITS.photosMax && (
                  <li>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={analyzing || isResizing}
                      className="w-full h-full min-h-28 rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-500/50 bg-zinc-950/40 flex flex-col items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5 text-emerald-300" aria-hidden="true" />
                      <span className="text-sm font-semibold text-zinc-300">Add photo</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="border-2 border-dashed border-white/15 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center bg-zinc-950/40">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Camera className="w-7 h-7" aria-hidden="true" />
              </div>
              <p className="font-bold text-sm text-zinc-100">Take or upload photos of your meal</p>
              <p className="text-sm text-zinc-400 mt-1 mb-4">
                Up to {MEAL_LIMITS.photosMax} photos: the plate, sides, or a nutrition label.
              </p>
              <Button
                type="button"
                variant="flat"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                isLoading={isResizing}
                startContent={<Upload className="w-4 h-4 text-emerald-400" />}
              >
                Choose or take photos
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <Select<MealType>
              id="analyze-meal-type"
              label="Meal"
              options={MEAL_TYPE_OPTIONS}
              value={mealType}
              disabled={analyzing}
              onChange={(value) => setMealType(value)}
            />
            <Textarea
              id="analyze-description"
              label="Description (optional)"
              description="Weights, oils and sauces you mention make the estimate more accurate."
              rows={3}
              maxLength={MEAL_LIMITS.aiDescriptionMax}
              value={description}
              disabled={analyzing}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. 200 g grilled chicken, 1 cup rice, broccoli with 1 tbsp olive oil"
            />
          </div>

          {review && !reviewOpen && (
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 space-y-3">
              <p className="text-sm text-zinc-300">
                {photosChanged
                  ? "You changed the photos since the last estimate. Analyze again to include them."
                  : `Your last estimate (${formatAmount(review.proposal.totals.calories)} kcal) is not saved yet.`}
              </p>
              {!photosChanged && (
                <Button type="button" variant="bordered" size="md" onClick={() => setReviewOpen(true)}>
                  Review and save
                </Button>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="solid"
            size="lg"
            className="w-full"
            onClick={analyze}
            disabled={analyzing || isResizing || (photos.length === 0 && !description.trim())}
            isLoading={analyzing}
            startContent={analyzing ? undefined : <Sparkles className="w-5 h-5" />}
          >
            {analyzing ? "Estimating..." : review ? "Analyze again" : "Estimate with AI"}
          </Button>
        </CardBody>
      </Card>

      {review && (
        <MealFormDialog
          isOpen={reviewOpen}
          idPrefix="review-meal"
          title="Review AI estimate"
          description="Check the ingredients and numbers. Nothing is saved until you press Save meal."
          initialDraft={review.draft}
          draft={review.draft}
          onChange={(next) => setReview((prev) => (prev ? { ...prev, draft: next } : prev))}
          maxDate={today}
          error={reviewError}
          submitLabel="Save meal"
          isSaving={saving}
          onSubmit={save}
          onClose={() => setReviewOpen(false)}
          headerSlot={
            <div className="space-y-3">
              {photos[0] && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-zinc-950">
                      <Image src={photo.previewUrl} alt={`Analyzed photo ${index + 1}`} fill sizes="64px" className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    AI assessment
                  </span>
                  <ConfidenceChip confidence={review.proposal.confidence} />
                </div>
                {review.proposal.confidenceReason && <p className="text-sm text-zinc-300">{review.proposal.confidenceReason}</p>}
                {review.proposal.geminiNotes && <p className="text-sm text-zinc-400">{review.proposal.geminiNotes}</p>}
                <p className="text-xs text-zinc-400">
                  Based on {review.photosAnalyzed > 0 ? `${review.photosAnalyzed} photo${review.photosAnalyzed === 1 ? "" : "s"}` : "your description only"}.
                </p>
                <MacroSplitBar macros={review.proposal.totals} />
                {review.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-amber-300 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    {warning}
                  </p>
                ))}
                {review.proposal.items.length === 0 && (
                  <p className="text-sm text-amber-300">The AI listed no ingredients. Check the totals before saving.</p>
                )}
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}

export default PhotoAnalyzer;
