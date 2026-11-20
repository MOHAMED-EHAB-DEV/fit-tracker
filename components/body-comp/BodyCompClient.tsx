"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Camera, ImagePlus, Loader2, Plus, Scale, Trash2, Zap } from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/context/UserContext";
import { errorMessage, requestJson } from "@/components/habits/api";
import { useLiveToday } from "@/components/habits/useLiveToday";
import { markDashboardStale } from "@/lib/dashboard/stale";
import type { AnalysisPreviewDTO, CheckInDTO } from "@/lib/body-comp/dto";
import {
  emptyCheckInValues,
  parseCheckInValues,
  valuesFromCheckIn,
  type CheckInFormErrors,
  type CheckInFormValues,
} from "@/lib/body-comp/form-values";
import { formatDateString } from "@/lib/time";
import { CheckInFields } from "./CheckInFields";
import { AnalysisView, CheckInCard } from "./CheckInCard";

interface BodyCompClientProps {
  initialCheckIns: CheckInDTO[];
  initialHasMore: boolean;
  todayStr: string;
  timeZone: string;
}

interface SelectedPhoto {
  blob: Blob;
  url: string;
  /** Changes on every pick, so an estimate can be tied to the exact photo. */
  key: number;
}

interface MutationResponse {
  success: true;
  checkIn: CheckInDTO;
  profileWeightKg: number | null;
}

interface ListResponse {
  success: true;
  checkIns: CheckInDTO[];
  hasMore: boolean;
}

const byNewest = (a: CheckInDTO, b: CheckInDTO) => b.checkInDate.localeCompare(a.checkInDate);

export function BodyCompClient({ initialCheckIns, initialHasMore, todayStr, timeZone }: BodyCompClientProps) {
  const { toast } = useToast();
  const { weightUnit, refreshUser } = useUser();
  const today = useLiveToday(todayStr, timeZone, {
    // A form left open overnight should default to the new day, not yesterday.
    onDayChange: (now, previous) =>
      setValues((current) => (current.dateString === previous ? { ...current, dateString: now } : current)),
  });
  const { resizeImage, isResizing } = useClientResize();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checkIns, setCheckIns] = useState<CheckInDTO[]>(initialCheckIns);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  // ---- new check-in form ----
  const [values, setValues] = useState<CheckInFormValues>(() => emptyCheckInValues(todayStr));
  const [errors, setErrors] = useState<CheckInFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const photoKeyRef = useRef(0);
  const [estimate, setEstimate] = useState<{ photoKey: number | null; analysis: AnalysisPreviewDTO } | null>(null);
  const [includeEstimate, setIncludeEstimate] = useState(true);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Free object URLs for replaced / removed / unmounted previews.
  useEffect(() => {
    const url = photo?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo]);

  // ---- edit / delete / lightbox ----
  const [editing, setEditing] = useState<CheckInDTO | null>(null);
  const [editValues, setEditValues] = useState<CheckInFormValues | null>(null);
  const [editErrors, setEditErrors] = useState<CheckInFormErrors>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<CheckInDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const afterMutation = useCallback(
    async (profileWeightKg: number | null) => {
      markDashboardStale();
      if (profileWeightKg !== null) await refreshUser();
    },
    [refreshUser]
  );

  // ---- photo handling ----
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please choose an image file.");
      return;
    }
    try {
      const resized = await resizeImage(file, { maxDimension: 1000, quality: 0.85 });
      photoKeyRef.current += 1;
      setPhoto({ blob: resized, url: URL.createObjectURL(resized), key: photoKeyRef.current });
      setFormError(null);
    } catch {
      setFormError("That photo could not be processed. Try a JPEG or PNG.");
    }
  };

  const removePhoto = () => {
    photoKeyRef.current += 1;
    setPhoto(null);
  };

  const appendFields = (form: FormData, payload: ReturnType<typeof parseCheckInValues>["payload"]) => {
    if (payload.weightKg !== null) form.append("weightKg", String(payload.weightKg));
    if (payload.bodyFatPercent !== null) form.append("bodyFatPercent", String(payload.bodyFatPercent));
    if (payload.measurements) form.append("measurements", JSON.stringify(payload.measurements));
    if (payload.notes) form.append("notes", payload.notes);
    form.append("dateString", payload.dateString);
  };

  const photoFileName = (blob: Blob) => `physique.${blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp"}`;

  // An estimate belongs to the photo it was made from (null = measurements only).
  const currentPhotoKey = photo?.key ?? null;
  const activeEstimate = estimate && estimate.photoKey === currentPhotoKey ? estimate.analysis : null;

  const handleRunEstimate = async () => {
    if (isEstimating) return;
    const parsed = parseCheckInValues(values, weightUnit, today);
    setErrors(parsed.errors);
    if (parsed.hasErrors) return;
    if (!photo && !parsed.payload.measurements) {
      setFormError("Add a photo or at least one measurement for an AI estimate.");
      return;
    }
    const requestedFor = currentPhotoKey;
    const requestKey = photoKeyRef.current;
    setIsEstimating(true);
    setFormError(null);
    try {
      const form = new FormData();
      appendFields(form, parsed.payload);
      if (photo) form.append("photo", photo.blob, photoFileName(photo.blob));
      const data = await requestJson<{ success: true; analysis: AnalysisPreviewDTO }>("/api/body-comp/estimate", {
        method: "POST",
        body: form,
      });
      // Ignore the answer if the photo was changed or removed while the request ran.
      if (photoKeyRef.current === requestKey) {
        setEstimate({ photoKey: requestedFor, analysis: data.analysis });
        setIncludeEstimate(true);
      }
    } catch (err) {
      setFormError(errorMessage(err, "The AI estimate failed. Please try again."));
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isResizing) return;
    const parsed = parseCheckInValues(values, weightUnit, today);
    setErrors(parsed.errors);
    if (parsed.hasErrors) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    const { payload } = parsed;
    if (payload.weightKg === null && payload.bodyFatPercent === null && !payload.measurements && !photo) {
      setFormError("Add at least one of: weight, body fat, a measurement or a photo.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const form = new FormData();
      appendFields(form, payload);
      if (photo) form.append("photo", photo.blob, photoFileName(photo.blob));
      if (activeEstimate && includeEstimate) form.append("aiAnalysis", JSON.stringify(activeEstimate));
      const data = await requestJson<MutationResponse>("/api/body-comp", { method: "POST", body: form });

      setCheckIns((prev) => [data.checkIn, ...prev.filter((c) => c._id !== data.checkIn._id)].sort(byNewest));
      setValues(emptyCheckInValues(today));
      setErrors({});
      removePhoto();
      setEstimate(null);
      toast(
        data.profileWeightKg !== null ? "Check-in saved. Your profile weight and targets were updated." : "Check-in saved.",
        "success"
      );
      await afterMutation(data.profileWeightKg);
    } catch (err) {
      setFormError(errorMessage(err, "Could not save the check-in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- list paging and photo URL refresh ----
  const loadMore = async () => {
    if (loadingMore || checkIns.length === 0) return;
    setLoadingMore(true);
    try {
      const last = checkIns[checkIns.length - 1];
      const data = await requestJson<ListResponse>(
        `/api/body-comp?limit=30&before=${encodeURIComponent(last.checkInDate)}&beforeId=${encodeURIComponent(last._id)}`
      );
      setCheckIns((prev) => {
        const seen = new Set(prev.map((c) => c._id));
        return [...prev, ...data.checkIns.filter((c) => !seen.has(c._id))];
      });
      setHasMore(data.hasMore);
    } catch (err) {
      toast(errorMessage(err, "Could not load older check-ins."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  // Signed photo URLs expire after 15 minutes; re-sign the loaded page once when one fails.
  const lastResignRef = useRef(0);
  const handlePhotoError = async () => {
    const now = Date.now();
    if (now - lastResignRef.current < 60_000) return;
    lastResignRef.current = now;
    try {
      const limit = Math.min(100, Math.max(1, checkIns.length));
      const data = await requestJson<ListResponse>(`/api/body-comp?limit=${limit}`);
      setCheckIns((prev) => {
        const fresh = new Map(data.checkIns.map((c) => [c._id, c]));
        return prev.map((c) => fresh.get(c._id) ?? c);
      });
    } catch {
      // The card shows the broken image; nothing else to do.
    }
  };

  // ---- edit ----
  const openEdit = (item: CheckInDTO) => {
    setEditing(item);
    setEditValues(valuesFromCheckIn(item, weightUnit));
    setEditErrors({});
  };

  const closeEdit = () => {
    if (isSavingEdit) return;
    setEditing(null);
    setEditValues(null);
  };

  const saveEdit = async () => {
    if (!editing || !editValues || isSavingEdit) return;
    const parsed = parseCheckInValues(editValues, weightUnit, today);
    setEditErrors(parsed.errors);
    if (parsed.hasErrors) return;
    const { payload } = parsed;
    if (payload.weightKg === null && payload.bodyFatPercent === null && !payload.measurements && editing.photos.length === 0) {
      setEditErrors({ weight: "Keep at least a weight, body fat or a measurement (or delete the check-in)." });
      return;
    }
    setIsSavingEdit(true);
    try {
      const data = await requestJson<MutationResponse>(`/api/body-comp/${editing._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          weightKg: payload.weightKg,
          bodyFatPercent: payload.bodyFatPercent,
          measurements: payload.measurements,
          notes: payload.notes,
          dateString: payload.dateString,
        }),
      });
      setCheckIns((prev) => prev.map((c) => (c._id === data.checkIn._id ? data.checkIn : c)).sort(byNewest));
      setEditing(null);
      setEditValues(null);
      toast("Check-in updated.", "success");
      await afterMutation(data.profileWeightKg);
    } catch (err) {
      toast(errorMessage(err, "Could not update the check-in."), "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ---- delete ----
  const confirmDelete = async () => {
    if (!deleting || isDeleting) return;
    setIsDeleting(true);
    try {
      const data = await requestJson<{ success: true; profileWeightKg: number | null }>(`/api/body-comp/${deleting._id}`, {
        method: "DELETE",
      });
      setCheckIns((prev) => prev.filter((c) => c._id !== deleting._id));
      setDeleting(null);
      toast("Check-in deleted.", "success");
      await afterMutation(data.profileWeightKg);
    } catch (err) {
      toast(errorMessage(err, "Could not delete the check-in."), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const busy = isSubmitting || isResizing;
  const submitLabel = isResizing ? "Preparing photo…" : isSubmitting ? (photo ? "Uploading & saving…" : "Saving…") : "Save check-in";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Body Composition & Physique</h1>
        <p className="text-sm text-zinc-400 mt-0.5">Record weigh-ins and measurements, with an optional private photo and AI body-fat estimate.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 rounded-[28px] bg-zinc-900/85 border border-white/10 space-y-5">
        <h2 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400" aria-hidden="true">
            <Scale className="w-5 h-5" />
          </span>
          New check-in
        </h2>

        {formError && (
          <div role="alert" className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <CheckInFields
          values={values}
          onChange={setValues}
          errors={errors}
          weightUnit={weightUnit}
          todayDateString={today}
          disabled={isSubmitting}
        />

        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400">Physique photo (private, optional)</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            aria-label="Choose a physique photo"
            className="hidden"
          />

          {photo ? (
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="space-y-2 shrink-0">
                <div className="relative w-36 h-48 rounded-2xl overflow-hidden border border-white/15 bg-zinc-950">
                  <Image src={photo.url} alt="Selected physique photo" fill unoptimized className="object-cover" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="min-h-11 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4" aria-hidden="true" /> Change
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={busy}
                    aria-label="Remove photo"
                    className="min-h-11 px-3 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-sm font-bold text-red-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full space-y-3">
                <p className="text-sm text-zinc-400">
                  Photos are stored privately and shown only to you through links that expire after a few minutes.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="w-full min-h-12 px-5 rounded-2xl bg-zinc-950/80 border border-dashed border-zinc-700 hover:border-emerald-500/50 text-zinc-200 text-sm font-bold flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
            >
              {isResizing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Camera className="w-4 h-4 text-emerald-400" aria-hidden="true" />}
              <span>{isResizing ? "Preparing photo…" : "Add a physique photo"}</span>
            </button>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRunEstimate}
              disabled={isEstimating || busy}
              aria-busy={isEstimating}
              className="min-h-11 px-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isEstimating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Zap className="w-4 h-4" aria-hidden="true" />}
              <span>{isEstimating ? "Estimating body fat…" : activeEstimate ? "Run the AI estimate again" : "Get an AI body-fat estimate"}</span>
            </button>
            {activeEstimate && (
              <>
                <AnalysisView analysis={activeEstimate} title="AI estimate (preview)" />
                <label className="flex items-center gap-2.5 min-h-11 text-sm text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeEstimate}
                    onChange={(e) => setIncludeEstimate(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500"
                  />
                  Save this estimate with the check-in
                </label>
              </>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || isEstimating}
          aria-busy={isSubmitting}
          className="w-full min-h-12 px-4 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
          <span>{submitLabel}</span>
        </button>
      </form>

      <section className="space-y-4" aria-labelledby="checkin-history-title">
        <h2 id="checkin-history-title" className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
          Check-in history
        </h2>
        {checkIns.length === 0 ? (
          <div className="p-8 rounded-3xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center text-zinc-400 text-sm">
            No check-ins yet. Record your weight above to start tracking.
          </div>
        ) : (
          <div className="space-y-4">
            {checkIns.map((item) => (
              <CheckInCard
                key={item._id}
                item={item}
                weightUnit={weightUnit}
                timeZone={timeZone}
                onEdit={openEdit}
                onDelete={setDeleting}
                onOpenPhoto={setLightboxUrl}
                onPhotoError={handlePhotoError}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full min-h-11 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm font-bold text-zinc-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Load older check-ins
              </button>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={Boolean(editing && editValues)}
        onClose={closeEdit}
        title="Edit check-in"
        size="xl"
        closeOnBackdropClick={!isSavingEdit}
        footer={
          <>
            <button
              type="button"
              onClick={closeEdit}
              disabled={isSavingEdit}
              className="min-h-11 px-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={isSavingEdit}
              aria-busy={isSavingEdit}
              className="min-h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save changes
            </button>
          </>
        }
      >
        {editValues && (
          <CheckInFields
            values={editValues}
            onChange={setEditValues}
            errors={editErrors}
            weightUnit={weightUnit}
            todayDateString={today}
            disabled={isSavingEdit}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => !isDeleting && setDeleting(null)}
        title="Delete check-in?"
        size="sm"
        closeOnBackdropClick={!isDeleting}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleting(null)}
              disabled={isDeleting}
              className="min-h-11 px-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="min-h-11 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
              Delete permanently
            </button>
          </>
        }
      >
        {deleting && (
          <p className="text-sm text-zinc-300 leading-relaxed">
            The check-in from{" "}
            <strong className="text-white">
              {formatDateString(deleting.dateString, { month: "short", day: "numeric", year: "numeric" })}
            </strong>{" "}
            {deleting.photos.length > 0 ? "and its photo will be deleted permanently" : "will be deleted permanently"}. This
            can&apos;t be undone.
          </p>
        )}
      </Modal>

      <Modal isOpen={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} size="lg" title="Physique photo">
        {lightboxUrl && (
          <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden bg-zinc-950">
            <Image src={lightboxUrl} alt="Physique photo, full size" fill unoptimized referrerPolicy="no-referrer" className="object-contain" />
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BodyCompClient;
