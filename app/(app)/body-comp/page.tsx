"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Scale, Camera, Plus, Sparkles, Trophy, Calendar, Loader2, AlertCircle } from "lucide-react";
import { useClientResize } from "@/hooks/useClientResize";

interface CheckIn {
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
    estimatedBodyFatRange: string;
    muscleGroupHighlights?: string[];
    recommendations?: string[];
  } | null;
  notes?: string;
}

export function BodyCompPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resizeImage, isResizing } = useClientResize();

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckIns();
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const resized = await resizeImage(file, { maxDimension: 1000, quality: 0.85 });
      setSelectedPhoto(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
      setError("Failed to process photo");
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
      if (bodyFat) formData.append("bodyFat", bodyFat);
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
      setBodyFat("");
      setNotes("");
      setSelectedPhoto(null);
      setPreviewUrl(null);
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
          Record weigh-ins, measurements, and private AI physique check-ins
        </p>
      </div>

      {/* Check-in Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-5 shadow-xl"
      >
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-400" />
          <span>New Progress Check-In</span>
        </h3>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Current Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Estimated Body Fat % (Optional)
            </label>
            <input
              type="number"
              step="0.5"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder="e.g. 14.5"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Physique Photo (Private Delivery & AI Analysis)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            className="hidden"
          />

          {previewUrl ? (
            <div className="relative w-36 h-48 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 group">
              <Image src={previewUrl} alt="Physique preview" fill className="object-cover" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 rounded-xl bg-zinc-950 border border-dashed border-zinc-700 hover:border-emerald-500/50 text-zinc-300 text-xs font-semibold flex items-center gap-2 transition"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Add Physique Photo</span>
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Notes / Observations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Morning fasted weigh-in, feeling leaner after 2 weeks in deficit..."
            rows={2}
            className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isResizing}
          className="w-full py-3.5 px-4 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting || isResizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Check-in & Analyzing...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Save Progress Check-In</span>
            </>
          )}
        </button>
      </form>

      {/* Past Check-Ins */}
      <div className="space-y-4">
        <h3 className="font-bold text-base text-white">Check-In History</h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading history...</span>
          </div>
        ) : checkIns.length === 0 ? (
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

              return (
                <div
                  key={item._id}
                  className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.weight && (
                        <span className="font-extrabold text-base text-white">
                          {item.weight} kg
                        </span>
                      )}
                      {item.bodyFatPercent && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {item.bodyFatPercent}% BF
                        </span>
                      )}
                    </div>
                  </div>

                  {item.notes && <p className="text-xs text-zinc-300">{item.notes}</p>}

                  {item.aiAnalysis && (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <Sparkles className="w-4 h-4" />
                        <span>Gemini Physique Analysis</span>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed">
                        {item.aiAnalysis.qualitativeNotes}
                      </p>
                      {item.aiAnalysis.estimatedBodyFatRange && (
                        <span className="inline-block text-[10px] uppercase font-bold text-zinc-400">
                          Estimated BF Range: <strong className="text-white">{item.aiAnalysis.estimatedBodyFatRange}</strong>
                        </span>
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

export default BodyCompPage;
