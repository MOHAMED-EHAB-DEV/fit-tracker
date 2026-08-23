"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import {
  Dumbbell,
  Loader2,
  Sparkles,
  Target,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExerciseDetail {
  _id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string;
  category: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  instructions?: string[];
  images?: string[];
}

export interface ExerciseInstructionsModalProps {
  catalogId: string | null;
  fallbackName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (exercise: ExerciseDetail) => void;
}

export function ExerciseInstructionsModal({
  catalogId,
  fallbackName,
  isOpen,
  onClose,
  onSelect,
}: ExerciseInstructionsModalProps) {
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || (!catalogId && !fallbackName)) {
      setExercise(null);
      setActiveImageIdx(0);
      setFailedImages(new Set());
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);
      setFailedImages(new Set());
      try {
        const idParam =
          catalogId && catalogId.trim()
            ? encodeURIComponent(catalogId.trim())
            : "lookup";
        const nameParam = fallbackName
          ? `&name=${encodeURIComponent(fallbackName.trim())}`
          : "";
        const res = await fetch(
          `/api/exercises/${idParam}?include=instructions,images${nameParam}`
        );
        if (!res.ok) {
          throw new Error("Failed to load exercise instructions");
        }
        const data = await res.json();
        if (data.success && data.exercise && isMounted) {
          setExercise(data.exercise);
          setActiveImageIdx(0);
        } else if (isMounted) {
          throw new Error(data.error || "Exercise not found");
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load instructions"
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, catalogId, fallbackName]);

  if (!isOpen) return null;

  const displayName = exercise?.name || fallbackName || "Exercise Instructions";

  const validImages = (exercise?.images || []).filter(
    (img) =>
      typeof img === "string" && img.trim().length > 0 && !failedImages.has(img)
  );

  const currentImageIdx = Math.min(
    activeImageIdx,
    Math.max(0, validImages.length - 1)
  );

  const validInstructions = (exercise?.instructions || []).filter(
    (s) => typeof s === "string" && s.trim().length > 0
  );

  const handleImageError = (imgUrl: string) => {
    setFailedImages((prev) => new Set(prev).add(imgUrl));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-linear-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">
              {displayName}
            </h3>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Technique & Form Guide
            </span>
          </div>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            Close Guide
          </button>

          {onSelect && exercise && (
            <button
              type="button"
              onClick={() => {
                onSelect(exercise);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Add to Routine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5 max-h-[65vh] overflow-y-auto pb-10 pr-1">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-xs font-semibold">
              Loading exercise instructions & biomechanics...
            </span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center space-y-2">
            <p className="text-sm font-bold text-zinc-300">
              Detailed instructions unavailable
            </p>
            <p className="text-xs text-zinc-500">
              Basic exercise details are recorded. Ensure proper bracing, posture,
              and controlled tempo.
            </p>
          </div>
        ) : exercise ? (
          <>
            {/* Exercise Images / Media Visual Gallery */}
            {validImages.length > 0 && (
              <div className="space-y-2">
                <div className="relative aspect-video sm:aspect-21/9 rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 flex items-center justify-center shadow-lg">
                  <Image
                    src={validImages[currentImageIdx] || validImages[0]}
                    alt={`${exercise.name} technique demonstration`}
                    fill
                    sizes="(max-width: 768px) 100vw, 700px"
                    onError={() =>
                      handleImageError(
                        validImages[currentImageIdx] || validImages[0]
                      )
                    }
                    className="object-contain bg-zinc-950"
                    priority
                  />
                  <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/10 text-[11px] font-bold text-zinc-300">
                    {currentImageIdx + 1} / {validImages.length}
                  </div>
                </div>

                {/* Thumbnails if more than 1 image */}
                {validImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {validImages.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={cn(
                          "relative w-16 h-12 rounded-xl overflow-hidden border shrink-0 transition cursor-pointer",
                          currentImageIdx === idx
                            ? "border-emerald-400 ring-2 ring-emerald-500/30 scale-105"
                            : "border-white/10 opacity-60 hover:opacity-100"
                        )}
                      >
                        <Image
                          src={imgUrl}
                          alt=""
                          fill
                          sizes="64px"
                          onError={() => handleImageError(imgUrl)}
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Meta Tags & Attributes Strip */}
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/8 space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Primary Muscle */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Target: {exercise.primaryMuscle}</span>
                </div>

                {/* Equipment */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 font-semibold capitalize">
                  <Dumbbell className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{exercise.equipment || "Other"}</span>
                </div>

                {/* Level */}
                {exercise.level && (
                  <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 font-semibold capitalize text-[11px]">
                    Level: {exercise.level}
                  </div>
                )}

                {/* Category */}
                {exercise.category && (
                  <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 font-semibold capitalize text-[11px]">
                    {exercise.category}
                  </div>
                )}

                {/* Force / Mechanic */}
                {exercise.force && (
                  <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold capitalize text-[11px]">
                    Force: {exercise.force}
                  </div>
                )}
                {exercise.mechanic && (
                  <div className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold capitalize text-[11px]">
                    {exercise.mechanic}
                  </div>
                )}
              </div>

              {/* Secondary Muscles */}
              {exercise.secondaryMuscles &&
                exercise.secondaryMuscles.length > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-white/6 text-xs">
                    <span className="text-zinc-500 font-semibold shrink-0">
                      Secondary Muscles:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {exercise.secondaryMuscles.map((muscle, mIdx) => (
                        <span
                          key={mIdx}
                          className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-white/6 text-zinc-400 text-[11px]"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Step-by-Step Execution Guide */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Step-by-Step Instructions</span>
              </h4>

              {validInstructions.length > 0 ? (
                <div className="space-y-2.5">
                  {validInstructions.map((step, stepIdx) => (
                    <div
                      key={stepIdx}
                      className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8 flex items-start gap-3 hover:border-white/15 transition"
                    >
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {stepIdx + 1}
                      </span>
                      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-1">
                  <p className="text-xs font-semibold text-zinc-400">
                    Perform {exercise.name} with controlled tempo, full range of
                    motion, and focus on target muscle engagement.
                  </p>
                </div>
              )}
            </div>

            {/* Key Performance Cues */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Form & Safety Tip</span>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Maintain a neutral spine, inhale on the eccentric phase (lowering)
                and exhale during exertion (lifting). Warm up adequately before
                heavy sets.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export default ExerciseInstructionsModal;
