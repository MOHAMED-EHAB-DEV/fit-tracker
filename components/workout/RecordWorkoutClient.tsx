"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dumbbell,
  Plus,
  Trash2,
  Check,
  Loader2,
  Calendar,
  ArrowLeft,
  Flame,
  Info,
} from "lucide-react";
import { DayOfWeek } from "@/lib/db/models/Workout";
import { SetRow, SetData } from "@/components/workout/SetRow";
import { ExerciseSearch } from "@/components/workout/ExerciseSearch";
import { WorkoutFloatingToolbar } from "@/components/workout/WorkoutFloatingToolbar";
import { ExerciseInstructionsModal } from "@/components/workout/ExerciseInstructionsModal";
import { useUser } from "@/context/UserContext";
import { DAYS_OF_WEEK } from "@/constants/workout";
import { calculateSessionDoneCalories } from "@/lib/fitness/workout-calories";

export interface ExerciseState {
  catalogId: string;
  name: string;
  muscleGroup: string;
  metValue?: number;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  warmupSets?: number;
  warmupReps?: number;
  warmupWeight?: number | null;
  sets: SetData[];
  notes?: string | null;
  oneRM?: number | null;
}

export function RecordWorkoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const initialDayParam = (searchParams.get("day") || "saturday").toLowerCase() as DayOfWeek;
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialDayParam);
  const [name, setName] = useState<string>("");
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Instructions modal state
  const [instructionCatalogId, setInstructionCatalogId] = useState<string | null>(null);
  const [instructionFallbackName, setInstructionFallbackName] = useState<string | undefined>(undefined);

  // Floating toolbar observer
  const headerRef = useRef<HTMLDivElement>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingToolbar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );

    const el = headerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  // Sync workout name from user's recurring routine for the selected day
  useEffect(() => {
    const routineDay = user?.weeklyRoutine?.find((r) => r.dayOfWeek === dayOfWeek);
    if (routineDay && !routineDay.isRestDay) {
      setName(routineDay.workoutName);
    } else {
      const capitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      setName(`${capitalized} Workout`);
    }
  }, [dayOfWeek, user]);

  const handleAddExercise = (exercise: {
    _id: string;
    name: string;
    primaryMuscle: string;
    metValue?: number;
  }) => {
    const newEx: ExerciseState = {
      catalogId: exercise._id,
      name: exercise.name,
      muscleGroup: exercise.primaryMuscle,
      metValue: exercise.metValue,
      weightUnit: "kg",
      isWarmup: false,
      sets: [
        {
          setNumber: 1,
          weight: 60,
          completedReps: 10,
          targetWeight: 60,
          targetReps: 10,
          rpe: 8,
          isWarmup: false,
          isPR: false,
          completedAt: new Date().toISOString(),
        },
      ],
    };
    setExercises((prev) => [...prev, newEx]);
    setShowSearch(false);
  };

  const handleAddSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      const workingSets = ex.sets.filter((s) => !s.isWarmup);
      const prevSet = workingSets[workingSets.length - 1] || ex.sets[ex.sets.length - 1];
      const newSet: SetData = {
        setNumber: ex.sets.length + 1,
        weight: prevSet?.weight || 60,
        completedReps: prevSet?.completedReps || 10,
        targetWeight: prevSet?.targetWeight || prevSet?.weight || 60,
        targetReps: prevSet?.targetReps || prevSet?.completedReps || 10,
        rpe: prevSet?.rpe || null,
        isWarmup: false,
        isPR: false,
        completedAt: new Date().toISOString(),
      };
      ex.sets.push(newSet);
      ex.sets = ex.sets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      return updated;
    });
  };

  const handleAddWarmupSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      const existingWarmups = ex.sets.filter((s) => s.isWarmup);
      const firstWorking = ex.sets.find((s) => !s.isWarmup);
      const baseWeight = firstWorking?.weight || firstWorking?.targetWeight || 60;

      const newWarmupSet: SetData = {
        setNumber: 1,
        weight:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].weight ?? Math.round(baseWeight * 0.5)
            : Math.round(baseWeight * 0.5),
        completedReps:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].completedReps ?? 12
            : 12,
        targetWeight:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].targetWeight ?? Math.round(baseWeight * 0.5)
            : Math.round(baseWeight * 0.5),
        targetReps:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].targetReps ?? 12
            : 12,
        rpe: null,
        isWarmup: true,
        isPR: false,
        completedAt: new Date().toISOString(),
      };

      const lastWarmupIdx = ex.sets.reduce((last, s, idx) => (s.isWarmup ? idx : last), -1);
      const newSets = [...ex.sets];
      newSets.splice(lastWarmupIdx + 1, 0, newWarmupSet);
      ex.sets = newSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      ex.isWarmup = true;
      ex.warmupSets = (ex.warmupSets || 0) + 1;
      return updated;
    });
  };

  const handleUpdateSet = (
    exerciseIndex: number,
    setIndex: number,
    updatedData: Partial<SetData>
  ) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      ex.sets[setIndex] = { ...ex.sets[setIndex], ...updatedData };
      return updated;
    });
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex].sets.splice(setIndex, 1);
      updated[exerciseIndex].sets = updated[exerciseIndex].sets.map((s, idx) => ({
        ...s,
        setNumber: idx + 1,
      }));
      return updated;
    });
  };

  const handleToggleWarmup = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      const nextWarmup = !ex.isWarmup;
      ex.isWarmup = nextWarmup;

      const workingSets = ex.sets.filter((s) => !s.isWarmup);
      const baseSet = workingSets[0] || ex.sets[0];
      const baseWeight = baseSet?.weight || baseSet?.targetWeight || 60;

      if (nextWarmup) {
        ex.warmupSets = ex.warmupSets || 1;
        ex.warmupReps = ex.warmupReps || 12;
        ex.warmupWeight = ex.warmupWeight ?? Math.round(baseWeight * 0.5);

        const warmupSetsList: SetData[] = Array.from({ length: ex.warmupSets }, (_, idx) => ({
          setNumber: idx + 1,
          weight: ex.warmupWeight ?? Math.round(baseWeight * 0.5),
          completedReps: ex.warmupReps ?? 12,
          targetWeight: ex.warmupWeight ?? Math.round(baseWeight * 0.5),
          targetReps: ex.warmupReps ?? 12,
          rpe: null,
          isWarmup: true,
          isPR: false,
          completedAt: new Date().toISOString(),
        }));

        ex.sets = [...warmupSetsList, ...workingSets].map((s, idx) => ({
          ...s,
          setNumber: idx + 1,
        }));
      } else {
        if (workingSets.length > 0) {
          ex.sets = workingSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        } else {
          ex.sets = ex.sets.map((s, idx) => ({ ...s, isWarmup: false, setNumber: idx + 1 }));
        }
      }

      return updated;
    });
  };

  const handleUpdateWarmupConfig = (
    exerciseIndex: number,
    config: { warmupSets?: number; warmupReps?: number; warmupWeight?: number | null }
  ) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      if (config.warmupSets !== undefined) ex.warmupSets = config.warmupSets;
      if (config.warmupReps !== undefined) ex.warmupReps = config.warmupReps;
      if (config.warmupWeight !== undefined) ex.warmupWeight = config.warmupWeight;

      const warmupCount = Math.max(1, ex.warmupSets || 1);
      const warmupReps = ex.warmupReps || 12;
      const warmupWeight = ex.warmupWeight ?? 20;

      const workingSets = ex.sets.filter((s) => !s.isWarmup);
      const existingWarmupSets = ex.sets.filter((s) => s.isWarmup);

      const newWarmupSets: SetData[] = Array.from({ length: warmupCount }, (_, idx) => {
        const existing = existingWarmupSets[idx];
        return {
          setNumber: idx + 1,
          weight: existing?.weight ?? warmupWeight,
          completedReps: existing?.completedReps ?? warmupReps,
          targetWeight: warmupWeight,
          targetReps: warmupReps,
          rpe: existing?.rpe ?? null,
          isWarmup: true,
          isPR: false,
          completedAt: existing?.completedAt ?? new Date().toISOString(),
        };
      });

      ex.sets = [...newWarmupSets, ...workingSets].map((s, idx) => ({
        ...s,
        setNumber: idx + 1,
      }));

      return updated;
    });
  };

  const handleDeleteExercise = (exerciseIndex: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
  };

  const handleSaveWorkout = async () => {
    if (exercises.length === 0) {
      setStatusMsg({ type: "error", text: "Please add at least one exercise before saving." });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} Workout`,
          dayOfWeek,
          exercises,
          status: "completed",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record workout stats");
      }

      setStatusMsg({ type: "success", text: "Workout recorded successfully!" });
      router.push("/workouts");
      router.refresh();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to record workout stats" });
      setIsSaving(false);
    }
  };

  // Compute live total lifted volume and burned calories for completed sets
  const totalVolume = exercises.reduce((sum, ex) => {
    return (
      sum +
      ex.sets.reduce((sSum, s) => {
        return sSum + ((s.weight || 0) * (s.completedReps || 0));
      }, 0)
    );
  }, 0);

  const userWeightKg = user?.fitnessProfile?.weightKg ?? 0;
  const burnedCalories = calculateSessionDoneCalories(exercises, userWeightKg);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Header with scroll observer */}
      <div ref={headerRef}>
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 min-h-10 min-w-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Record Workout Stats
              </h1>
              <p className="text-xs text-zinc-400">
                Record your real weights, sets, and reps for your weekly routine
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={handleSaveWorkout}
            className="px-5 py-3 min-h-11 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Save Workout Log</span>
          </button>
        </header>
      </div>

      {/* Status Messages */}
      {statusMsg && (
        <div
          role="alert"
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Workout Metadata Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        {/* Day of Week Selector */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5 select-none">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span>Assigned Day of the Week</span>
          </label>
          <div role="group" aria-label="Select day of the week" className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = dayOfWeek === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setDayOfWeek(d.key)}
                  className={`py-2 px-1 min-h-10 rounded-xl text-xs font-bold transition text-center border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isSelected
                      ? "bg-emerald-500 text-zinc-950 border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {d.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workout Name Input */}
        <div>
          <label htmlFor="record-workout-name" className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Workout Routine Name
          </label>
          <input
            id="record-workout-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Day (Chest & Triceps)"
            className="w-full px-4 py-3 min-h-11 bg-zinc-950 border border-zinc-800 rounded-2xl text-white font-extrabold text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>

        {/* Summary Stats */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs text-zinc-400 flex-wrap gap-2">
          <span>Exercises: <strong className="text-white tabular-nums">{exercises.length}</strong></span>
          <span>Lifted Volume: <strong className="text-emerald-400 tabular-nums">{totalVolume.toLocaleString()} kg</strong></span>
          <span>Calories Burned: <strong className="text-orange-400 tabular-nums">{burnedCalories} kcal</strong></span>
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {exercises.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-3xl space-y-3 bg-zinc-900/40">
            <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200">No Exercises Added Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Add exercises to log your target and completed weights, reps, and sets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-10 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add Exercise</span>
            </button>
          </div>
        ) : (
          exercises.map((exercise, exIdx) => {
            const isWarmup = !!exercise.isWarmup;
            return (
            <div
              key={exercise.catalogId + exIdx}
              className={`p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border space-y-4 shadow-lg transition-all ${
                isWarmup
                  ? "border-amber-500/30 bg-linear-to-b from-amber-500/5 to-zinc-900/80"
                  : "border-zinc-800/80"
              }`}
            >
              {/* Exercise Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-white">
                      {exercise.name}
                    </h3>

                    {/* Instructions Info button */}
                    <button
                      type="button"
                      onClick={() => {
                        setInstructionCatalogId(exercise.catalogId);
                        setInstructionFallbackName(exercise.name);
                      }}
                      className="p-1 rounded-lg bg-zinc-950/80 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer shadow-xs active:scale-95 group/info focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      title="View exercise instructions & execution guide"
                      aria-label={`View instructions for ${exercise.name}`}
                    >
                      <Info className="w-3.5 h-3.5 transition-transform group-hover/info:scale-110" aria-hidden="true" />
                    </button>

                    {isWarmup && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Warmup Active
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">
                    {exercise.muscleGroup}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleWarmup(exIdx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-xl text-xs font-bold transition cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isWarmup
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20"
                        : "bg-zinc-950/60 text-zinc-400 border-white/8 hover:text-zinc-200"
                    }`}
                    title={isWarmup ? "Disable Warmup Sets" : "Activate Warmup Sets for this exercise"}
                  >
                    <Flame className={`w-3.5 h-3.5 ${isWarmup ? "text-amber-400 fill-amber-400/40" : "text-zinc-500"}`} aria-hidden="true" />
                    <span>{isWarmup ? "Warmup Option Active" : "Add Warmup"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteExercise(exIdx)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-lg"
                    title="Remove exercise"
                    aria-label={`Remove ${exercise.name}`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Warmup Sets Configuration Box (Visible when Warmup is Active) */}
              {isWarmup && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                      <Flame className="w-3 h-3 text-amber-400" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-300">
                        Warmup Set(s) Configuration
                      </h4>
                      <p className="text-[10px] text-amber-200/70">
                        Configure warmup sets count, target reps, and target weight
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Warmup Sets Stepper */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block select-none">
                        Warmup Sets
                      </span>
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateWarmupConfig(exIdx, {
                              warmupSets: Math.max(1, (exercise.warmupSets || 1) - 1),
                            })
                          }
                          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          aria-label="Decrease warmup sets"
                        >
                          -
                        </button>
                        <span className="font-extrabold text-white text-sm tabular-nums">
                          {exercise.warmupSets || 1} Warmup {exercise.warmupSets === 1 ? "Set" : "Sets"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateWarmupConfig(exIdx, {
                              warmupSets: Math.min(5, (exercise.warmupSets || 1) + 1),
                            })
                          }
                          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs flex items-center justify-center transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          aria-label="Increase warmup sets"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Target Warmup Reps */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
                      <label htmlFor={`warmup-reps-${exIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block select-none">
                        Warmup Target Reps
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`warmup-reps-${exIdx}`}
                          type="number"
                          min="1"
                          max="100"
                          value={exercise.warmupReps || 12}
                          onChange={(e) =>
                            handleUpdateWarmupConfig(exIdx, {
                              warmupReps: parseInt(e.target.value, 10) || 12,
                            })
                          }
                          className="w-full text-center py-1 px-2 min-h-9 bg-zinc-900 border border-amber-500/30 rounded-lg text-white font-extrabold text-sm tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                        />
                        <span className="text-xs text-amber-300/70 font-bold">reps</span>
                      </div>
                    </div>

                    {/* Target Warmup Weight */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-amber-500/20 space-y-1">
                      <label htmlFor={`warmup-weight-${exIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80 block select-none">
                        Warmup Target Weight
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`warmup-weight-${exIdx}`}
                          type="number"
                          step="0.5"
                          value={exercise.warmupWeight ?? ""}
                          onChange={(e) =>
                            handleUpdateWarmupConfig(exIdx, {
                              warmupWeight: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="e.g. 20"
                          className="w-full text-center py-1 px-2 min-h-9 bg-zinc-900 border border-amber-500/30 rounded-lg text-white font-extrabold text-sm tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                        />
                        <span className="text-xs text-amber-300 font-extrabold uppercase shrink-0">
                          {exercise.weightUnit || "kg"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Column Headers */}
              <div className="flex items-center gap-1.5 sm:gap-3 px-2.5 text-[10px] uppercase font-bold text-zinc-500 select-none">
                <div className="w-5 sm:w-7 text-center shrink-0">Set</div>
                <div className="hidden sm:block w-20 sm:w-24 text-center shrink-0">Target</div>
                <div className="flex-1 text-center min-w-14 sm:min-w-17.5">Weight ({exercise.weightUnit || "kg"})</div>
                <div className="flex-1 text-center min-w-12 sm:min-w-15">Reps</div>
                <div className="w-12 sm:w-14 text-center shrink-0 hidden md:block">RPE</div>
                <div className="w-7 sm:w-8 text-center shrink-0">Done</div>
                <div className="w-6"></div>
              </div>

              {/* Set Rows */}
              <div className="space-y-2">
                {exercise.sets.map((set, setIdx) => (
                  <SetRow
                    key={setIdx}
                    set={set}
                    index={setIdx}
                    unit={exercise.weightUnit || "kg"}
                    onChange={(data) => handleUpdateSet(exIdx, setIdx, data)}
                    onDelete={() => handleDeleteSet(exIdx, setIdx)}
                    onComplete={() => {}}
                  />
                ))}
              </div>

              {/* Action Buttons: Add Working Set & Add Warmup Set */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddSet(exIdx)}
                  className="flex-1 py-2.5 min-h-10 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold border border-dashed border-zinc-700/80 transition flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Working Set</span>
                </button>

                {isWarmup && (
                  <button
                    type="button"
                    onClick={() => handleAddWarmupSet(exIdx)}
                    className="py-2.5 px-4 min-h-10 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-dashed border-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    title="Add another Warmup Set"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span>+ Warmup Set</span>
                  </button>
                )}
              </div>
            </div>
            );
          })
        )}

        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="w-full py-3.5 min-h-11 rounded-3xl bg-zinc-900 hover:bg-zinc-800/80 text-emerald-400 text-xs font-bold border border-zinc-800 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Another Exercise</span>
          </button>
        )}
      </div>

      {/* Floating Bottom Toolbar (Appears when scrolled past header) */}
      <WorkoutFloatingToolbar
        isVisible={showFloatingToolbar}
        isSaving={isSaving}
        hasUnsavedChanges={exercises.length > 0}
        statusText="Record Log"
        addExerciseLabel="Add Exercise"
        onAddExercise={() => setShowSearch(true)}
        saveLabel="Save Workout Log"
        discardLabel="Discard"
        discardTitle="Discard Workout Log?"
        discardDescription="Are you sure you want to discard this workout log? Any entered exercises, sets, and reps will be lost."
        onSave={handleSaveWorkout}
        onDiscard={() => {
          router.push("/workouts");
        }}
      />

      {/* Exercise Instructions Modal */}
      <ExerciseInstructionsModal
        catalogId={instructionCatalogId}
        fallbackName={instructionFallbackName}
        isOpen={!!instructionCatalogId || !!instructionFallbackName}
        onClose={() => {
          setInstructionCatalogId(null);
          setInstructionFallbackName(undefined);
        }}
      />

      {/* Exercise Search & Catalog Modal */}
      {showSearch && (
        <ExerciseSearch
          onSelect={handleAddExercise}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

export default RecordWorkoutClient;
