"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  Scale,
  Camera,
  Plus,
  Sparkles,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  X,
  Ruler,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  Cpu,
} from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";
import { Modal } from "@/components/ui/Modal";

export interface CheckInItem {
  _id: string;
  checkInDate: string;
  dateString?: string;
  weight?: number | null;
  bodyFatPercent?: number | null;
  measurements?: {
    chest?: number | null;
    waist?: number | null;
    hips?: number | null;
    arms?: number | null;
    thighs?: number | null;
  } | null;
  photos?: Array<{
    cloudinaryPublicId: string;
    angle?: "front" | "side" | "back";
    signedUrl: string;
  }>;
  aiAnalysis?: {
    qualitativeNotes: string;
    estimatedBodyFatPercent?: number | null;
    estimatedBodyFatRange: string;
    comparedToPrevious?: string;
    muscleGroupHighlights?: string[];
    recommendations?: string[];
    modelUsed?: string;
    generatedAt?: string | null;
  } | null;
  notes?: string;
  createdAt?: string;
}

interface BodyCompClientProps {
  initialCheckIns: CheckInItem[];
}

export function BodyCompClient({ initialCheckIns }: BodyCompClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resizeImage, isResizing } = useClientResize();

  const [checkIns, setCheckIns] = useState<CheckInItem[]>(initialCheckIns);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Circumference Measurements state
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [arms, setArms] = useState("");
  const [thighs, setThighs] = useState("");

  // Lightbox modal state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [aiPreview, setAiPreview] = useState<{
    estimatedBodyFatPercent: number | null;
    estimatedBodyFatRange: string;
    qualitativeNotes: string;
    muscleGroupHighlights: string[];
    recommendations: string[];
  } | null>(null);

  const fetchCheckIns = async () => {
    try {
      const res = await fetch("/api/body-comp");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.checkIns)) {
          setCheckIns(data.checkIns);
        }
      }
    } catch (err) {
      console.error("Failed to load body comp data:", err);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const resized = await resizeImage(file, { maxDimension: 1000, quality: 0.85 });
      setSelectedPhoto(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setAiPreview(null);
      setError(null);
    } catch {
      setError("Failed to process photo");
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setAiPreview(null);
  };

  const getMeasurementsPayload = () => {
    if (!chest && !waist && !hips && !arms && !thighs) return null;
    return {
      chest: chest ? parseFloat(chest) : null,
      waist: waist ? parseFloat(waist) : null,
      hips: hips ? parseFloat(hips) : null,
      arms: arms ? parseFloat(arms) : null,
      thighs: thighs ? parseFloat(thighs) : null,
    };
  };

  const handleRunAiEstimation = async () => {
    if (!selectedPhoto && !weight) {
      setError("Please add a physique photo or enter weight for AI body fat estimation.");
      return;
    }

    setIsEstimating(true);
    setError(null);

    try {
      const formData = new FormData();
      if (weight) formData.append("weight", weight);
      if (notes) formData.append("notes", notes);
      if (selectedPhoto) formData.append("photo", selectedPhoto, "physique.webp");

      const measurements = getMeasurementsPayload();
      if (measurements) {
        formData.append("measurements", JSON.stringify(measurements));
      }

      const res = await fetch("/api/body-comp/estimate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to estimate body fat with AI");
      }

      setAiPreview(data.analysis);
    } catch (err: any) {
      setError(err.message || "Failed to run AI estimation");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight && !selectedPhoto) {
      setError("Please enter your weight or upload a physique photo.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (weight) formData.append("weight", weight);
      if (notes) formData.append("notes", notes);
      if (selectedPhoto) formData.append("photo", selectedPhoto, "physique.webp");

      const measurements = getMeasurementsPayload();
      if (measurements) {
        formData.append("measurements", JSON.stringify(measurements));
      }

      const res = await fetch("/api/body-comp", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record check-in");
      }

      // Reset form
      setWeight("");
      setNotes("");
      setChest("");
      setWaist("");
      setHips("");
      setArms("");
      setThighs("");
      setSelectedPhoto(null);
      setPreviewUrl(null);
      setAiPreview(null);
      fetchCheckIns();
    } catch (err: any) {
      setError(err.message || "Failed to record check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Body Composition & Physique
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Record weigh-ins, circumference measurements, and estimate body fat % with Gemini Flash AI vision
        </p>
      </div>

      {/* Check-in Form */}
      <form
        onSubmit={handleSubmit}
        className="p-5 sm:p-6 rounded-[28px] bg-zinc-900/85 backdrop-blur-2xl border border-white/10 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Scale className="w-5 h-5" aria-hidden="true" />
            </div>
            <span>New Progress Check-In</span>
          </h3>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Weight & AI Info Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodycomp-weight" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
              Current Weight (kg) *
            </label>
            <input
              id="bodycomp-weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
              className="w-full px-4 py-3 min-h-11 bg-zinc-950/80 border border-white/10 rounded-2xl text-white placeholder-zinc-500 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-bold"
            />
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Gemini Flash Vision Analysis</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-1 font-medium">
              Body fat percentage is objectively estimated from anatomical landmarks, subcutaneous definition, and measurements.
            </p>
          </div>
        </div>

        {/* Optional Circumference Measurements Section */}
        <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-3">
          <button
            type="button"
            onClick={() => setShowMeasurements(!showMeasurements)}
            className="w-full flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-teal-400" />
              <span>Circumference Measurements (Optional cm)</span>
            </span>
            <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
              <span>{showMeasurements ? "Hide Measurements" : "Add Measurements"}</span>
              {showMeasurements ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showMeasurements && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-white/6 animate-in fade-in duration-200">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Chest (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={chest}
                  onChange={(e) => setChest(e.target.value)}
                  placeholder="e.g. 104"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Waist (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  placeholder="e.g. 82"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Hips (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={hips}
                  onChange={(e) => setHips(e.target.value)}
                  placeholder="e.g. 98"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Arms (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={arms}
                  onChange={(e) => setArms(e.target.value)}
                  placeholder="e.g. 39"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Thighs (cm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={thighs}
                  onChange={(e) => setThighs(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Photo Upload & AI Vision Section */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none">
            Physique Photo (Private Delivery & Gemini AI Analysis)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            aria-label="Upload physique progress photo"
            className="hidden"
          />

          {previewUrl ? (
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="relative w-36 h-48 rounded-2xl overflow-hidden border border-white/15 bg-zinc-950 group shrink-0 shadow-lg">
                <Image
                  src={previewUrl}
                  alt="Physique preview"
                  fill
                  onError={handleRemovePhoto}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 text-xs font-bold text-white transition">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRunAiEstimation}
                    disabled={isEstimating || isResizing}
                    className="px-4 py-2.5 min-h-11 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isEstimating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Estimating with Gemini Flash...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>⚡ Run Live AI Body Fat Estimate</span>
                      </>
                    )}
                  </button>
                </div>

                {aiPreview && (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Gemini Flash Estimate
                      </span>
                      {aiPreview.estimatedBodyFatPercent && (
                        <span className="text-sm font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tabular-nums">
                          {aiPreview.estimatedBodyFatPercent}% BF
                        </span>
                      )}
                    </div>
                    {aiPreview.estimatedBodyFatRange && (
                      <p className="text-xs text-zinc-400">
                        Estimated Range: <strong className="text-zinc-100">{aiPreview.estimatedBodyFatRange}</strong>
                      </p>
                    )}
                    {aiPreview.qualitativeNotes && (
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {aiPreview.qualitativeNotes}
                      </p>
                    )}
                    {aiPreview.muscleGroupHighlights.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {aiPreview.muscleGroupHighlights.map((hl, i) => (
                          <span key={i} className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700">
                            {hl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-5 py-4 min-h-11 rounded-2xl bg-zinc-950/80 border border-dashed border-zinc-700 hover:border-emerald-500/50 text-zinc-300 text-xs font-bold flex items-center justify-center gap-2.5 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Camera className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Add Physique Photo for AI Body Fat Estimation</span>
            </button>
          )}
        </div>

        {/* Observations / Notes */}
        <div>
          <label htmlFor="bodycomp-notes" className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Notes / Observations
          </label>
          <textarea
            id="bodycomp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Morning fasted weigh-in, feeling leaner after 2 weeks in deficit..."
            rows={2}
            className="w-full px-4 py-2.5 bg-zinc-950/80 border border-white/10 rounded-2xl text-white placeholder-zinc-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-medium"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isResizing || isEstimating}
          aria-busy={isSubmitting || isResizing || isEstimating}
          className="w-full py-3.5 px-4 min-h-11 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold rounded-2xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-98"
        >
          {isSubmitting || isResizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Saving Check-in & Analyzing with AI...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Save Progress Check-In</span>
            </>
          )}
        </button>
      </form>

      {/* Past Check-Ins History Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
            <span>Check-In History</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              {checkIns.length} Entries
            </span>
          </h3>
        </div>

        {checkIns.length === 0 ? (
          <div className="p-8 rounded-3xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center text-zinc-500 text-sm">
            No check-ins logged yet. Record your current weight above to begin tracking.
          </div>
        ) : (
          <div className="space-y-4">
            {checkIns.map((item) => {
              const dateObj = new Date(item.checkInDate || item.createdAt || Date.now());
              const date = dateObj.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const time = dateObj.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              const bf = item.bodyFatPercent ?? item.aiAnalysis?.estimatedBodyFatPercent ?? null;
              const hasMeasurements = item.measurements && Object.values(item.measurements).some((v) => v !== null && v !== undefined);
              const hasPhotos = Array.isArray(item.photos) && item.photos.length > 0;

              return (
                <div
                  key={item._id}
                  className="p-5 sm:p-6 rounded-[28px] bg-zinc-900/85 backdrop-blur-2xl border border-white/10 hover:border-white/20 transition-all shadow-xl space-y-4"
                >
                  {/* Card Header: Date, Weight, Body Fat % */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/6">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                        <Calendar className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base text-white">
                            {date}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">
                            {time}
                          </span>
                        </div>
                        {item.dateString && (
                          <span className="text-[11px] text-zinc-400">
                            Log Date: {item.dateString}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {item.weight && (
                        <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950/80 border border-white/8 text-end">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">Weight</span>
                          <span className="font-black text-base text-white tabular-nums">
                            {item.weight} <span className="text-xs font-normal text-zinc-400">kg</span>
                          </span>
                        </div>
                      )}
                      {bf !== null && (
                        <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-end">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Body Fat</span>
                          <span className="font-black text-base text-emerald-300 tabular-nums flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                            <span>{bf}%</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Physique Photos Gallery Strip */}
                  {hasPhotos && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Physique Photos ({item.photos!.length})</span>
                      </span>
                      <div className="flex items-center gap-3 overflow-x-auto pb-1">
                        {item.photos!.map((photo, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => photo.signedUrl && setLightboxUrl(photo.signedUrl)}
                            className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 shrink-0 cursor-pointer group shadow-md"
                          >
                            <Image
                              src={photo.signedUrl}
                              alt={`Physique ${photo.angle || "check-in"}`}
                              fill
                              sizes="128px"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Eye className="w-5 h-5" />
                            </div>
                            {photo.angle && (
                              <span className="absolute bottom-1.5 inset-s-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-zinc-950/80 text-emerald-300 border border-white/10">
                                {photo.angle}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Circumference Measurements Grid */}
                  {hasMeasurements && item.measurements && (
                    <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-teal-400 tracking-wider flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5" />
                        <span>Circumference Measurements</span>
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                        {item.measurements.chest !== null && item.measurements.chest !== undefined && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Chest</span>
                            <span className="font-extrabold text-white tabular-nums">{item.measurements.chest} cm</span>
                          </div>
                        )}
                        {item.measurements.waist !== null && item.measurements.waist !== undefined && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Waist</span>
                            <span className="font-extrabold text-white tabular-nums">{item.measurements.waist} cm</span>
                          </div>
                        )}
                        {item.measurements.hips !== null && item.measurements.hips !== undefined && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Hips</span>
                            <span className="font-extrabold text-white tabular-nums">{item.measurements.hips} cm</span>
                          </div>
                        )}
                        {item.measurements.arms !== null && item.measurements.arms !== undefined && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Arms</span>
                            <span className="font-extrabold text-white tabular-nums">{item.measurements.arms} cm</span>
                          </div>
                        )}
                        {item.measurements.thighs !== null && item.measurements.thighs !== undefined && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Thighs</span>
                            <span className="font-extrabold text-white tabular-nums">{item.measurements.thighs} cm</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes / Observations */}
                  {item.notes && (
                    <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/6 flex items-start gap-2.5">
                      <FileText className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        <strong className="text-zinc-400 font-semibold">Note: </strong>
                        {item.notes}
                      </p>
                    </div>
                  )}

                  {/* Complete AI Vision Analysis Breakdown */}
                  {item.aiAnalysis && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                      {/* AI Header & Engine Info */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          </div>
                          <span className="text-xs font-extrabold text-emerald-400">
                            Gemini Flash Physique Analysis
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          {item.aiAnalysis.modelUsed && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-white/8 text-zinc-300 font-mono flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-emerald-400" />
                              <span>{item.aiAnalysis.modelUsed}</span>
                            </span>
                          )}
                          {item.aiAnalysis.estimatedBodyFatRange && (
                            <span className="font-semibold text-zinc-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              Range: <strong className="text-white">{item.aiAnalysis.estimatedBodyFatRange}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qualitative Notes */}
                      {item.aiAnalysis.qualitativeNotes && (
                        <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                          {item.aiAnalysis.qualitativeNotes}
                        </p>
                      )}

                      {/* Compared to Previous Check-in */}
                      {item.aiAnalysis.comparedToPrevious && (
                        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/6 flex items-start gap-2 text-xs text-zinc-300">
                          <TrendingUp className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-teal-300 me-1">Comparison:</span>
                            <span>{item.aiAnalysis.comparedToPrevious}</span>
                          </div>
                        </div>
                      )}

                      {/* Standout Muscle Group Highlights */}
                      {Array.isArray(item.aiAnalysis.muscleGroupHighlights) && item.aiAnalysis.muscleGroupHighlights.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                            Standout Muscle Highlights:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.aiAnalysis.muscleGroupHighlights.map((hl, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-zinc-900 text-zinc-200 border border-white/10 shadow-xs"
                              >
                                {hl}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actionable Recommendations Checklist */}
                      {Array.isArray(item.aiAnalysis.recommendations) && item.aiAnalysis.recommendations.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/6">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                            Actionable Coach Recommendations:
                          </span>
                          <ul className="text-xs text-zinc-300 space-y-1.5">
                            {item.aiAnalysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-snug">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxUrl && (
        <Modal
          isOpen={Boolean(lightboxUrl)}
          onClose={() => setLightboxUrl(null)}
          size="lg"
          title="Physique Photo Full View"
        >
          <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center">
            <Image
              src={lightboxUrl}
              alt="Physique enlarged preview"
              fill
              className="object-contain"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default BodyCompClient;
