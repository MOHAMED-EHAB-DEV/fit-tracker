"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Scale, Camera, Plus, Sparkles, Calendar, Loader2, AlertCircle, CheckCircle2, Zap, X } from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";

export interface CheckInItem {
  _id: string;
  checkInDate: string;
  weight?: number | null;
  bodyFatPercent?: number | null;
  photos?: Array<{
    cloudinaryPublicId: string;
    signedUrl: string;
  }>;
  aiAnalysis?: {
    qualitativeNotes: string;
    estimatedBodyFatPercent?: number | null;
    estimatedBodyFatRange: string;
    muscleGroupHighlights?: string[];
    recommendations?: string[];
  } | null;
  notes?: string;
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
        if (data.success) {
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Body Composition & Physique
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Record weigh-ins, measurements, and estimate body fat % with Gemini Flash AI vision
        </p>
      </div>

      {/* Check-in Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-5 shadow-xl"
      >
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>New Progress Check-In</span>
        </h3>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bodycomp-weight" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
              Current Weight (kg)
            </label>
            <input
              id="bodycomp-weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
              className="w-full px-3.5 py-2.5 min-h-11 bg-zinc-950 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>AI Body Fat Estimation</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
              Body fat is automatically estimated by Gemini Flash AI from your physique photos and anthropometric data.
            </p>
          </div>
        </div>

        {/* Photo Upload & AI Vision Section */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
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
              <div className="relative w-36 h-48 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 group shrink-0">
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
                    className="px-2.5 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 cursor-pointer"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-600 cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunAiEstimation}
                    disabled={isEstimating || isResizing}
                    className="px-3.5 py-2 min-h-11 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
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
                  <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/30 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Gemini Flash Estimate
                      </span>
                      {aiPreview.estimatedBodyFatPercent && (
                        <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tabular-nums">
                          {aiPreview.estimatedBodyFatPercent}% BF
                        </span>
                      )}
                    </div>
                    {aiPreview.estimatedBodyFatRange && (
                      <p className="text-[11px] text-zinc-400">
                        Estimated Range: <strong className="text-zinc-200">{aiPreview.estimatedBodyFatRange}</strong>
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
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
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
              className="w-full sm:w-auto px-4 py-3 min-h-11 rounded-xl bg-zinc-950 border border-dashed border-zinc-700 hover:border-emerald-500/50 text-zinc-300 text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Camera className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Add Physique Photo for AI Body Fat Estimation</span>
            </button>
          )}
        </div>

        <div>
          <label htmlFor="bodycomp-notes" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Notes / Observations
          </label>
          <textarea
            id="bodycomp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Morning fasted weigh-in, feeling leaner after 2 weeks in deficit..."
            rows={2}
            className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isResizing || isEstimating}
          aria-busy={isSubmitting || isResizing || isEstimating}
          className="w-full py-3.5 px-4 min-h-11 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-98"
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

      {/* Past Check-Ins */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white">Check-In History</h3>

        {checkIns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center text-zinc-500 text-sm">
            No check-ins logged yet. Record your current weight above to begin tracking.
          </div>
        ) : (
          <div className="space-y-4">
            {checkIns.map((item) => {
              const date = new Date(item.checkInDate).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              const bf = item.bodyFatPercent ?? item.aiAnalysis?.estimatedBodyFatPercent ?? null;

              return (
                <div
                  key={item._id}
                  className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                      <span>{date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.weight && (
                        <span className="font-extrabold text-base text-white tabular-nums">
                          {item.weight} kg
                        </span>
                      )}
                      {bf !== null && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 tabular-nums flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                          <span>{bf}% BF</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {item.notes && <p className="text-xs text-zinc-300">{item.notes}</p>}

                  {item.aiAnalysis && (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                          <Sparkles className="w-4 h-4" aria-hidden="true" />
                          <span>Gemini Flash Physique Analysis</span>
                        </div>
                        {item.aiAnalysis.estimatedBodyFatRange && (
                          <span className="text-[11px] font-semibold text-zinc-400">
                            Estimated Range: <strong className="text-white">{item.aiAnalysis.estimatedBodyFatRange}</strong>
                          </span>
                        )}
                      </div>

                      {item.aiAnalysis.qualitativeNotes && (
                        <p className="text-xs text-zinc-200 leading-relaxed">
                          {item.aiAnalysis.qualitativeNotes}
                        </p>
                      )}

                      {Array.isArray(item.aiAnalysis.muscleGroupHighlights) && item.aiAnalysis.muscleGroupHighlights.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-400">Standout Highlights:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.aiAnalysis.muscleGroupHighlights.map((hl, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/60"
                              >
                                {hl}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(item.aiAnalysis.recommendations) && item.aiAnalysis.recommendations.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-zinc-800/80">
                          <span className="text-[10px] uppercase font-bold text-zinc-400">AI Recommendations:</span>
                          <ul className="text-xs text-zinc-300 space-y-1">
                            {item.aiAnalysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{rec}</span>
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
    </div>
  );
}

export default BodyCompClient;
