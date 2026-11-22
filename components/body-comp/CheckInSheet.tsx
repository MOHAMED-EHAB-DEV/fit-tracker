"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SuggestedCard } from "@/components/ui/SuggestedCard";
import { errorMessage, requestJson } from "@/components/habits/api";
import { useClientResize } from "@/hooks/useClientResize";
import { AnalysisView } from "./AnalysisView";
import { CheckInFields } from "./CheckInFields";
import type { WeightUnit } from "@/lib/fitness/units";
import type { AnalysisPreviewDTO, CheckInDTO } from "@/lib/body-comp/dto";
import {
  emptyCheckInValues,
  parseCheckInValues,
  valuesFromCheckIn,
  type CheckInFormErrors,
  type CheckInFormValues,
} from "@/lib/body-comp/form-values";

interface CheckInSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Edit this check-in (fields only); a new one when absent. */
  checkIn?: CheckInDTO | null;
  weightUnit: WeightUnit;
  today: string;
  onSaved: (checkIn: CheckInDTO, profileWeightKg: number | null, kind: "created" | "updated") => void;
}

interface SelectedPhoto {
  blob: Blob;
  url: string;
  /** Changes on every pick, so an estimate is tied to the exact photo. */
  key: number;
}

type Saved = { success: true; checkIn: CheckInDTO; profileWeightKg: number | null };

const photoFileName = (blob: Blob) => `physique.${blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp"}`;

/**
 * Check in: date, weight, measured body fat, measurements, notes, and an
 * optional private photo. The AI body-fat estimate is a Suggestion the user
 * accepts (saved with the check-in) or dismisses. Editing changes the fields.
 */
export function CheckInSheet(props: CheckInSheetProps) {
  const key = props.isOpen ? props.checkIn?._id ?? "new" : "closed";
  return <CheckInSheetInner key={key} {...props} />;
}

function CheckInSheetInner({ isOpen, onClose, checkIn = null, weightUnit, today, onSaved }: CheckInSheetProps) {
  const isEdit = Boolean(checkIn);
  const { resizeImage, isResizing } = useClientResize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoKeyRef = useRef(0);
  const [values, setValues] = useState<CheckInFormValues>(() =>
    checkIn ? valuesFromCheckIn(checkIn, weightUnit) : emptyCheckInValues(today)
  );
  const [errors, setErrors] = useState<CheckInFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [estimate, setEstimate] = useState<{ photoKey: number | null; analysis: AnalysisPreviewDTO; accepted: boolean } | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Release the preview of a replaced or removed photo.
  useEffect(() => {
    const url = photo?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  const currentPhotoKey = photo?.key ?? null;
  const activeEstimate = estimate && estimate.photoKey === currentPhotoKey ? estimate : null;
  const busy = saving || isResizing;

  const pickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Choose an image file.");
      return;
    }
    try {
      const resized = await resizeImage(file, { maxDimension: 1000, quality: 0.85 });
      photoKeyRef.current += 1;
      setPhoto({ blob: resized, url: URL.createObjectURL(resized), key: photoKeyRef.current });
      setFormError(null);
    } catch {
      setFormError("That photo could not be read. Try a JPEG or PNG.");
    }
  };

  const appendFields = (form: FormData, payload: ReturnType<typeof parseCheckInValues>["payload"]) => {
    if (payload.weightKg !== null) form.append("weightKg", String(payload.weightKg));
    if (payload.bodyFatPercent !== null) form.append("bodyFatPercent", String(payload.bodyFatPercent));
    if (payload.measurements) form.append("measurements", JSON.stringify(payload.measurements));
    if (payload.notes) form.append("notes", payload.notes);
    form.append("dateString", payload.dateString);
  };

  const runEstimate = async () => {
    if (isEstimating) return;
    const parsed = parseCheckInValues(values, weightUnit, today);
    setErrors(parsed.errors);
    if (parsed.hasErrors) return;
    if (!photo && !parsed.payload.measurements) {
      setFormError("Add a photo or at least one measurement for an AI estimate.");
      return;
    }
    const requestKey = photoKeyRef.current;
    const requestedFor = currentPhotoKey;
    setIsEstimating(true);
    setFormError(null);
    try {
      const form = new FormData();
      appendFields(form, parsed.payload);
      if (photo) form.append("photo", photo.blob, photoFileName(photo.blob));
      const data = await requestJson<{ success: true; analysis: AnalysisPreviewDTO }>("/api/body-comp/estimate", { method: "POST", body: form });
      // A photo changed or removed while the request ran makes the answer stale.
      if (photoKeyRef.current === requestKey) setEstimate({ photoKey: requestedFor, analysis: data.analysis, accepted: false });
    } catch (err) {
      setFormError(errorMessage(err, "The AI estimate failed. Please try again."));
    } finally {
      setIsEstimating(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = parseCheckInValues(values, weightUnit, today);
    setErrors(parsed.errors);
    if (parsed.hasErrors) return;
    const { payload } = parsed;
    const hasPhotos = isEdit ? (checkIn?.photos.length ?? 0) > 0 : Boolean(photo);
    if (payload.weightKg === null && payload.bodyFatPercent === null && !payload.measurements && !hasPhotos) {
      setFormError("Add at least one of: weight, body fat, a measurement or a photo.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (checkIn) {
        const data = await requestJson<Saved>(`/api/body-comp/${checkIn._id}`, {
          method: "PATCH",
          body: JSON.stringify({
            weightKg: payload.weightKg,
            bodyFatPercent: payload.bodyFatPercent,
            measurements: payload.measurements,
            notes: payload.notes,
            dateString: payload.dateString,
          }),
        });
        onSaved(data.checkIn, data.profileWeightKg, "updated");
      } else {
        const form = new FormData();
        appendFields(form, payload);
        if (photo) form.append("photo", photo.blob, photoFileName(photo.blob));
        if (activeEstimate?.accepted) form.append("aiAnalysis", JSON.stringify(activeEstimate.analysis));
        const data = await requestJson<Saved>("/api/body-comp", { method: "POST", body: form });
        onSaved(data.checkIn, data.profileWeightKg, "created");
      }
      onClose();
    } catch (err) {
      setFormError(errorMessage(err, "Could not save the check-in. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title={isEdit ? "Edit check-in" : "Check in"}
      description={isEdit ? undefined : "Weight, body fat, measurements and a private photo: add what you have."}
      size="lg"
      closeOnBackdropClick={!busy}
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="check-in-form" isLoading={busy} disabled={isEstimating}>
            {isResizing ? "Preparing photo…" : isEdit ? "Save" : "Save check-in"}
          </Button>
        </div>
      }
    >
      <form id="check-in-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}

        <CheckInFields values={values} onChange={setValues} errors={errors} weightUnit={weightUnit} todayDateString={today} disabled={saving} />

        {!isEdit && (
          <section aria-labelledby="check-in-photo" className="space-y-2.5">
            <h3 id="check-in-photo" className="text-[13px] font-medium text-ink-2">
              Physique photo (private, optional)
            </h3>
            <input
              type="file"
              ref={fileInputRef}
              onChange={pickPhoto}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              aria-label="Choose a physique photo"
              className="hidden"
            />
            {photo ? (
              <div className="flex items-start gap-3">
                <div className="relative h-36 w-28 shrink-0 overflow-hidden rounded-control border border-line bg-elevated">
                  <Image src={photo.url} alt="Selected physique photo" fill unoptimized className="object-cover" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs leading-5 text-ink-3">Stored privately; shown only to you through links that expire after a few minutes.</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={busy} startContent={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => fileInputRef.current?.click()}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      startContent={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => {
                        photoKeyRef.current += 1;
                        setPhoto(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-50 cursor-pointer"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {isResizing ? "Preparing photo…" : "Add a photo"}
              </button>
            )}

            {activeEstimate || isEstimating ? (
              <SuggestedCard
                meta="Body-fat estimate"
                state={activeEstimate?.accepted ? "applied" : "suggested"}
                isLoading={isEstimating}
                acceptLabel="Keep with check-in"
                onAccept={() => setEstimate((current) => (current ? { ...current, accepted: true } : current))}
                onDismiss={() => setEstimate(null)}
              >
                {activeEstimate && <AnalysisView analysis={activeEstimate.analysis} />}
              </SuggestedCard>
            ) : (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void runEstimate()}>
                Get an AI body-fat estimate
              </Button>
            )}
          </section>
        )}
      </form>
    </Sheet>
  );
}

export default CheckInSheet;
