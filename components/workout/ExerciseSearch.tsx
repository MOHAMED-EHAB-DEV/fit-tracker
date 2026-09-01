"use client";

import React, { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import {
  Search,
  Plus,
  Dumbbell,
  Loader2,
  Sparkles,
  Activity,
  ArrowLeft,
  Target,
  Layers,
  Check,
  Info,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface ExerciseItem {
  _id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string;
  category: string;
  metValue?: number;
  level?: string;
  force?: string | null;
  mechanic?: string | null;
  instructions?: string[];
  images?: string[];
}

interface ExerciseSearchProps {
  onSelect: (exercise: ExerciseItem) => void;
  onClose: () => void;
}

import { EXERCISE_SEARCH_CATEGORIES as CATEGORIES } from "@/constants/exercise";

export function ExerciseSearch({ onSelect, onClose }: ExerciseSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  // State for internal Instruction Tab/View
  const [instructionExerciseId, setInstructionExerciseId] = useState<string | null>(null);
  const [instructionData, setInstructionData] = useState<ExerciseItem | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);

  // Fetch initial list of exercises (excluding heavy instructions for fast payload)
  useEffect(() => {
    let isMounted = true;
    const fetchExercises = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (selectedCategory !== "all") {
          if (selectedCategory === "bodyweight") {
            params.set("equipment", "bodyweight");
          } else {
            params.set("category", selectedCategory);
          }
        }
        params.set("limit", "80");

        const res = await fetch(`/api/exercises?${params.toString()}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success) {
            startTransition(() => {
              setExercises(data.exercises || []);
            });
          }
        }
      } catch (err) {
        console.error("Failed to search exercises:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchExercises, 150);
    return () => {
      isMounted = false;
      clearTimeout(debounce);
    };
  }, [query, selectedCategory]);

  // On-demand fetch of instructions and images when user clicks the '!' button
  useEffect(() => {
    if (!instructionExerciseId) {
      setInstructionData(null);
      setActiveImageIdx(0);
      setFailedImages(new Set());
      return;
    }

    let isMounted = true;
    const fetchInstructions = async () => {
      setIsLoadingInstructions(true);
      setFailedImages(new Set());
      try {
        const res = await fetch(`/api/exercises/${encodeURIComponent(instructionExerciseId)}?include=instructions,images`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success && data.exercise) {
            setInstructionData(data.exercise);
            setActiveImageIdx(0);
          }
        }
      } catch (err) {
        console.error("Failed to fetch exercise instructions:", err);
      } finally {
        if (isMounted) setIsLoadingInstructions(false);
      }
    };

    fetchInstructions();

    return () => {
      isMounted = false;
    };
  }, [instructionExerciseId]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="lg"
      title={
        instructionExerciseId ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setInstructionExerciseId(null)}
              className="p-1.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition cursor-pointer"
              title="Back to exercise search"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {instructionData?.name || "Exercise Instructions"}
              </h3>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Technique & Execution
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white">Select Exercise or Stretch</span>
          </div>
        )
      }
      footer={
        instructionExerciseId && instructionData && !isLoadingInstructions ? (
          <div className="w-full flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setInstructionExerciseId(null)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              ← Back to List
            </button>

            <button
              type="button"
              onClick={() => {
                onSelect(instructionData);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Workout</span>
            </button>
          </div>
        ) : undefined
      }
    >
      {instructionExerciseId ? (
        /* INLINE INSTRUCTION TAB */
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pb-10 pr-1">
          {isLoadingInstructions ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
              <span className="text-xs font-semibold">Loading instructions...</span>
            </div>
          ) : instructionData ? (
            (() => {
              const validInstructionImages = (instructionData.images || []).filter(
                (img) => typeof img === "string" && img.trim().length > 0 && !failedImages.has(img)
              );
              const currentImgIdx = Math.min(activeImageIdx, Math.max(0, validInstructionImages.length - 1));
              const validSteps = (instructionData.instructions || []).filter(
                (s) => typeof s === "string" && s.trim().length > 0
              );

              return (
                <>
                  {/* Media Visual Gallery */}
                  {validInstructionImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="relative aspect-video sm:aspect-21/9 rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 flex items-center justify-center shadow-lg">
                        <Image
                          src={validInstructionImages[currentImgIdx] || validInstructionImages[0]}
                          alt={`${instructionData.name} technique demonstration`}
                          fill
                          sizes="(max-width: 768px) 100vw, 700px"
                          onError={() => {
                            const broken = validInstructionImages[currentImgIdx] || validInstructionImages[0];
                            setFailedImages((prev) => new Set(prev).add(broken));
                          }}
                          className="object-contain bg-zinc-950"
                          priority
                        />
                        <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/10 text-[11px] font-bold text-zinc-300">
                          {currentImgIdx + 1} / {validInstructionImages.length}
                        </div>
                      </div>

                      {/* Thumbnails if multiple images */}
                      {validInstructionImages.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {validInstructionImages.map((imgUrl, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveImageIdx(idx)}
                              className={cn(
                                "relative w-16 h-12 rounded-xl overflow-hidden border shrink-0 transition cursor-pointer",
                                currentImgIdx === idx
                                  ? "border-emerald-400 ring-2 ring-emerald-500/30 scale-105"
                                  : "border-white/10 opacity-60 hover:opacity-100"
                              )}
                            >
                              <Image
                                src={imgUrl}
                                alt=""
                                fill
                                sizes="64px"
                                onError={() => setFailedImages((prev) => new Set(prev).add(imgUrl))}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta Tags Strip */}
                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/8 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Target: {instructionData.primaryMuscle}</span>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 font-semibold capitalize">
                        <Dumbbell className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{instructionData.equipment || "Other"}</span>
                      </div>

                      {instructionData.level && (
                        <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 font-semibold capitalize text-[11px]">
                          Level: {instructionData.level}
                        </div>
                      )}

                      {instructionData.category && (
                        <div className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 font-semibold capitalize text-[11px]">
                          {instructionData.category}
                        </div>
                      )}

                      {instructionData.force && (
                        <div className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold capitalize text-[11px]">
                          Force: {instructionData.force}
                        </div>
                      )}

                      {instructionData.mechanic && (
                        <div className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold capitalize text-[11px]">
                          {instructionData.mechanic}
                        </div>
                      )}
                    </div>

                    {instructionData.secondaryMuscles && instructionData.secondaryMuscles.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-white/6 text-xs">
                        <span className="text-zinc-500 font-semibold shrink-0">Secondary Muscles:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {instructionData.secondaryMuscles.map((muscle, mIdx) => (
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

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Execution Steps</span>
                    </h4>

                    {validSteps.length > 0 ? (
                      <div className="space-y-2">
                        {validSteps.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8 flex items-start gap-3 hover:border-white/15 transition"
                          >
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                              {sIdx + 1}
                            </span>
                            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-1">
                        <p className="text-xs font-semibold text-zinc-400">
                          Perform {instructionData.name} with controlled tempo, full range of motion, and focus on target muscle engagement.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()
          ) : null}
        </div>
      ) : (
        /* STANDARD EXERCISE LIST VIEW */
        <div className="space-y-3.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 870+ exercises, stretches, or muscle groups..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 text-zinc-950 shadow-xs shadow-emerald-500/20"
                      : "bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800/80"
                  }`}
                >
                  {cat.id === "stretching" && (
                    <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5 text-cyan-300" />
                  )}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Exercise List */}
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-14 text-zinc-500 gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading exercises & stretches...</span>
              </div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-14 text-zinc-500 text-sm space-y-1">
                <p className="font-semibold text-zinc-400">No movements found</p>
                <p className="text-xs text-zinc-600">
                  Try searching for a different muscle or category
                </p>
              </div>
            ) : (
              exercises.map((ex) => {
                const isStretch = ex.category?.toLowerCase() === "stretching";

                return (
                  <div
                    key={ex._id}
                    onClick={() => onSelect(ex)}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 shrink-0 transition">
                        {isStretch ? (
                          <Activity className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Dumbbell className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-zinc-200 group-hover:text-white truncate">
                            {ex.name}
                          </h4>
                          {isStretch && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                              Stretch
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          <span className="font-semibold text-emerald-400">
                            {ex.primaryMuscle}
                          </span>
                          <span className="text-zinc-700">•</span>
                          <span className="text-zinc-400 capitalize truncate">
                            {ex.equipment}
                          </span>
                          {ex.level && (
                            <>
                              <span className="text-zinc-700">•</span>
                              <span className="text-zinc-500 capitalize">{ex.level}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Instructions Info button & '+' Add button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInstructionExerciseId(ex._id);
                        }}
                        className="w-7 h-7 rounded-xl bg-zinc-900 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/15 text-zinc-400 hover:text-emerald-300 flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95 group/info"
                        title="View instructions & form guide"
                      >
                        <Info className="w-3.5 h-3.5 transition-transform group-hover/info:scale-110" />
                      </button>

                      <div
                        className="w-7 h-7 rounded-xl bg-zinc-900 border border-white/10 group-hover:bg-emerald-500 group-hover:text-zinc-950 text-zinc-400 flex items-center justify-center transition"
                        title="Select this exercise"
                      >
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ExerciseSearch;

