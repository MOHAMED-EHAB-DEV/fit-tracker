"use client";

import React, { useState, useId, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  CheckCircle2,
  ChevronRight,
  Target,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  PenSquare,
  Plus,
  Play,
  Layers,
  ExternalLink,
  Edit3,
  Activity,
  Check,
  GripVertical,
  Search,
  X,
  ArrowRightLeft,
  MoveRight,
  Shuffle,
  Flame,
  Info,
} from "lucide-react";
import { IWeeklyRoutineDay } from "@/lib/db/models/User";
import { updateWeeklyRoutineAction } from "@/lib/fitness/actions";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), {
  ssr: false,
});

export type DayOfWeekKey = "saturday" | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

export interface IWeeklyWorkoutExercise {
  name: string;
  muscleGroup: string;
  setsCount: number;
  targetReps?: number;
  targetWeight?: number;
  weightUnit?: string;
}

export interface IWeeklyDaySession {
  dayName: string; // "Saturday", "Sunday", etc.
  dayShort: string; // "Sat", "Sun", etc.
  dayOfWeek: DayOfWeekKey;
  isToday: boolean;
  workoutName: string;
  isRestDay: boolean;
  targetMuscleGroups?: string[];
  exercisesCount?: number;
  targetSetsCount?: number;
  workoutId?: string;
  isCompletedThisWeek?: boolean;
  status?: string;
  totalVolume?: number;
  exercises?: IWeeklyWorkoutExercise[];
}

export interface IAvailableWorkoutItem {
  id?: string;
  name: string;
  muscleGroups?: string[];
  exercisesCount?: number;
  isRest?: boolean;
}

export interface IMuscleVolumeGroup {
  muscle: string;
  sets: number;
  targetSets: number;
  colorClass: string;
}

interface WeeklySplitMapProps {
  days: IWeeklyDaySession[];
  weeklyVolumeKg: number;
  weeklyTargetVolumeKg: number;
  muscleBreakdown: IMuscleVolumeGroup[];
  weeklyRoutine?: IWeeklyRoutineDay[];
  availableWorkouts?: IAvailableWorkoutItem[];
}

import { SPLIT_PRESETS, DAYS_ORDER } from "@/constants/workout";

const DEFAULT_DECK_ITEMS: IAvailableWorkoutItem[] = [
  { name: "Rest & Active Recovery", isRest: true, muscleGroups: [] },
  { name: "Muay Thai & Conditioning", isRest: false, muscleGroups: ["Core", "Cardio"] },
  { name: "Push Day (Chest & Triceps)", isRest: false, muscleGroups: ["Chest", "Shoulders", "Arms"] },
  { name: "Pull Day (Back & Biceps)", isRest: false, muscleGroups: ["Back", "Arms"] },
  { name: "Leg Day (Quads & Glutes)", isRest: false, muscleGroups: ["Legs"] },
  { name: "Cardio & HIIT", isRest: false, muscleGroups: ["Cardio"] },
  { name: "Mobility & Core", isRest: false, muscleGroups: ["Core"] },
];

export function WeeklySplitMap({
  days,
  weeklyVolumeKg,
  weeklyTargetVolumeKg,
  muscleBreakdown,
  weeklyRoutine,
  availableWorkouts = [],
}: WeeklySplitMapProps) {
  const router = useRouter();
  const headingId = useId();

  const [selectedDay, setSelectedDay] = useState<IWeeklyDaySession | null>(null);
  const [isCustomizingRoutine, setIsCustomizingRoutine] = useState<boolean>(false);
  const [routineDraft, setRoutineDraft] = useState<IWeeklyRoutineDay[]>([]);
  const [isSavingRoutine, setIsSavingRoutine] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{
    type: "pool" | "slot";
    name: string;
    isRest: boolean;
    targetMuscleGroups?: string[];
    fromDayKey?: DayOfWeekKey;
  } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<DayOfWeekKey | null>(null);

  const volPct = Math.min(100, Math.round((weeklyVolumeKg / (weeklyTargetVolumeKg || 1)) * 100));

  // Combined workouts deck
  const workoutsDeck = useMemo(() => {
    const map = new Map<string, IAvailableWorkoutItem>();

    // 1. User saved workouts from DB
    availableWorkouts.forEach((w) => {
      const key = w.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, w);
      }
    });

    // 2. Default fallback deck items
    DEFAULT_DECK_ITEMS.forEach((d) => {
      const key = d.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, d);
      }
    });

    return Array.from(map.values());
  }, [availableWorkouts]);

  // Open the Weekly Routine Customizer Modal
  const handleOpenRoutineCustomizer = () => {
    const currentRoutine: IWeeklyRoutineDay[] = DAYS_ORDER.map((dayKey) => {
      const existing = weeklyRoutine?.find((r) => r.dayOfWeek === dayKey) ||
        days.find((d) => d.dayOfWeek === dayKey);

      return {
        dayOfWeek: dayKey,
        workoutName: existing ? existing.workoutName : "Push Day",
        isRestDay: existing ? existing.isRestDay ?? false : false,
        targetMuscleGroups: existing ? (existing as any).targetMuscleGroups || [] : [],
      };
    });

    setRoutineDraft(currentRoutine);
    setIsCustomizingRoutine(true);
    setStatusMsg(null);
  };

  // Helper: Find which days a workout is currently assigned to
  const getAssignedDays = (workoutName: string, isRest: boolean) => {
    return routineDraft
      .filter((d) => {
        if (isRest) return d.isRestDay;
        return (
          !d.isRestDay &&
          d.workoutName.toLowerCase().trim() === workoutName.toLowerCase().trim()
        );
      })
      .map((d) => d.dayOfWeek);
  };

  // Apply a Preset Split
  const handleApplyPreset = (preset: (typeof SPLIT_PRESETS)[0]) => {
    const newRoutine: IWeeklyRoutineDay[] = preset.routine.map((r) => ({
      dayOfWeek: r.day,
      workoutName: r.workout,
      isRestDay: r.isRest,
      targetMuscleGroups: [],
    }));
    setRoutineDraft(newRoutine);
  };

  // Update a single day in the routine draft
  const handleUpdateRoutineDay = (
    dayOfWeek: DayOfWeekKey,
    workoutName: string,
    isRestDay: boolean,
    targetMuscleGroups?: string[]
  ) => {
    setRoutineDraft((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              workoutName,
              isRestDay: isRestDay || workoutName.toLowerCase().includes("rest"),
              targetMuscleGroups: targetMuscleGroups ?? d.targetMuscleGroups ?? [],
            }
          : d
      )
    );
  };

  // Drag and drop handlers
  const handleDragStartFromPool = (
    e: React.DragEvent,
    item: IAvailableWorkoutItem
  ) => {
    const payload = {
      type: "pool" as const,
      name: item.name,
      isRest: !!item.isRest || item.name.toLowerCase().includes("rest"),
      targetMuscleGroups: item.muscleGroups || [],
    };
    setDraggedItem(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDragStartFromSlot = (
    e: React.DragEvent,
    day: IWeeklyRoutineDay
  ) => {
    const payload = {
      type: "slot" as const,
      fromDayKey: day.dayOfWeek as DayOfWeekKey,
      name: day.workoutName,
      isRest: day.isRestDay,
      targetMuscleGroups: day.targetMuscleGroups || [],
    };
    setDraggedItem(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverSlot = (e: React.DragEvent, dayKey: DayOfWeekKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== dayKey) {
      setDragOverDay(dayKey);
    }
  };

  const handleDragLeaveSlot = (e: React.DragEvent, dayKey: DayOfWeekKey) => {
    e.preventDefault();
    if (dragOverDay === dayKey) {
      setDragOverDay(null);
    }
  };

  const handleDropOnSlot = (e: React.DragEvent, targetDayKey: DayOfWeekKey) => {
    e.preventDefault();
    setDragOverDay(null);

    let payload = draggedItem;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) payload = JSON.parse(raw);
      } catch (err) {
        console.error("Failed to parse drag payload:", err);
      }
    }

    if (!payload) return;

    if (payload.type === "slot" && payload.fromDayKey) {
      if (payload.fromDayKey === targetDayKey) return;
      // Swap the two day routines
      setRoutineDraft((prev) => {
        const sourceDay = prev.find((d) => d.dayOfWeek === payload!.fromDayKey);
        const targetDay = prev.find((d) => d.dayOfWeek === targetDayKey);
        if (!sourceDay || !targetDay) return prev;

        return prev.map((d) => {
          if (d.dayOfWeek === targetDayKey) {
            return {
              ...d,
              workoutName: sourceDay.workoutName,
              isRestDay: sourceDay.isRestDay,
              targetMuscleGroups: sourceDay.targetMuscleGroups,
            };
          }
          if (d.dayOfWeek === payload!.fromDayKey) {
            return {
              ...d,
              workoutName: targetDay.workoutName,
              isRestDay: targetDay.isRestDay,
              targetMuscleGroups: targetDay.targetMuscleGroups,
            };
          }
          return d;
        });
      });
    } else if (payload.type === "pool") {
      handleUpdateRoutineDay(
        targetDayKey,
        payload.name,
        payload.isRest,
        payload.targetMuscleGroups
      );
    }

    setDraggedItem(null);
  };

  // Save Routine to MongoDB
  const handleSaveRoutine = async () => {
    setIsSavingRoutine(true);
    setStatusMsg(null);

    try {
      const res = await updateWeeklyRoutineAction(routineDraft);
      if (!res.success) throw new Error(res.error || "Failed to update routine");

      setStatusMsg({ type: "success", text: "Weekly training split saved!" });
      setTimeout(() => {
        setIsCustomizingRoutine(false);
        setStatusMsg(null);
      }, 600);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to save weekly split" });
    } finally {
      setIsSavingRoutine(false);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-5 flex flex-col justify-between"
    >
      {/* Semantic Header with Split Manager & Training Record Link */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h3 id={headingId} className="font-bold text-base text-white">
              Weekly Training Split
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Your repeating weekly routine schedule (Saturday → Friday)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Link to record real workout stats */}
          <Link
            href="/workouts/record"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <PenSquare className="w-3.5 h-3.5" />
            <span>Record Workout</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenRoutineCustomizer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs font-bold transition shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Edit Split</span>
          </button>

          <Link
            href="/workouts"
            aria-label="View all workouts"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>All Workouts</span>
            <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 7-Day Recurring Strip (Saturday to Friday, pure weekday view) */}
      <ol
        aria-label="Weekly training routine by day of week"
        className="grid grid-cols-7 gap-1.5 sm:gap-2 overflow-x-auto list-none"
      >
        {days.map((d) => {
          const shortWorkoutTitle = d.workoutName?.split(" (")[0] || (d.isRestDay ? "Rest" : "Workout");

          return (
            <li key={d.dayOfWeek} aria-current={d.isToday ? "date" : undefined}>
              <button
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`w-full text-left p-2 sm:p-3 rounded-2xl border flex flex-col justify-between transition min-w-0 relative overflow-hidden group cursor-pointer hover:border-emerald-500/60 active:scale-95 ${
                  d.isToday
                    ? "bg-zinc-800/90 border-emerald-500/50 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40"
                    : d.isCompletedThisWeek
                    ? "bg-emerald-950/20 border-emerald-500/40 hover:bg-emerald-950/30"
                    : d.isRestDay
                    ? "bg-zinc-950/40 border-zinc-800/40 hover:bg-zinc-900/60"
                    : "bg-zinc-950/80 border-zinc-800/80 hover:bg-zinc-900"
                }`}
              >
                {d.isToday && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}

                <div>
                  {/* Day of Week Name & Completed Check */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider block truncate ${
                        d.isToday ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      {d.dayShort}
                    </span>
                    {d.isCompletedThisWeek && (
                      <span title="Completed this week" className="flex items-center text-emerald-400">
                        <Check className="w-3 h-3 stroke-3" />
                      </span>
                    )}
                  </div>

                  {/* Assigned Workout Name */}
                  <div className="mt-1.5 min-h-8 flex flex-col justify-center">
                    <span
                      className={`text-[11px] sm:text-xs font-bold block truncate ${
                        d.isRestDay ? "text-zinc-500 font-medium" : "text-white"
                      }`}
                    >
                      {d.isRestDay ? "Rest" : shortWorkoutTitle}
                    </span>
                  </div>

                  {/* Status / Exercise Count Indicator */}
                  <div className="mt-1 flex items-center gap-1">
                    {d.isCompletedThisWeek ? (
                      <span className="text-[9px] font-bold text-emerald-400 block truncate">
                        ✅ Logged
                      </span>
                    ) : d.isRestDay ? (
                      <span className="text-[9px] font-semibold text-zinc-600 block truncate">
                        🌿 Off
                      </span>
                    ) : d.exercisesCount && d.exercisesCount > 0 ? (
                      <span className="text-[9px] font-semibold text-emerald-400/90 block truncate">
                        🏋️ {d.exercisesCount} Ex
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-zinc-500 block truncate">
                        🎯 Planned
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Weekly Volume & Muscle Group Set Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-2 border-t border-zinc-800/80">
        {/* Volume Meter */}
        <article className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Weekly Volume Goal
            </span>
            <Target aria-hidden="true" className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xl sm:text-2xl font-extrabold text-white">
              {weeklyVolumeKg.toLocaleString()}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500">
              / {weeklyTargetVolumeKg.toLocaleString()} kg
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={volPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly lifted volume target progress"
            className="w-full h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${volPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>{volPct}% reached</span>
            <span>{Math.max(0, weeklyTargetVolumeKg - weeklyVolumeKg).toLocaleString()} kg to go</span>
          </div>
        </article>

        {/* Muscle Groups Sets Breakdown */}
        <article className="md:col-span-2 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Muscle Volume (Sets)
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">Target: ~10-20</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {muscleBreakdown.map((m) => {
              const pct = Math.min(100, Math.round((m.sets / (m.targetSets || 1)) * 100));
              return (
                <div
                  key={m.muscle}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${m.muscle} sets: ${m.sets} of ${m.targetSets}`}
                  className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] gap-1">
                    <span className="font-semibold text-zinc-200 truncate">{m.muscle}</span>
                    <span className="font-bold text-white shrink-0">{m.sets}<span className="text-[9px] text-zinc-500">/{m.targetSets}</span></span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${m.colorClass} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* 1. MODAL: SIMPLE DRAG & DROP WEEKLY SPLIT PLANNER */}
      {isCustomizingRoutine && (
        <Modal
          isOpen={true}
          onClose={() => setIsCustomizingRoutine(false)}
          size="lg"
          title={
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    Weekly Split Planner
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Drag workouts onto days, or drag days to swap them
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Drag & Drop</span>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Status alerts */}
            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  statusMsg.type === "success"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/15 border border-red-500/30 text-red-300"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Workout Deck: Draggable Workout Chips with Live Day Badges */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Your Workouts (Drag to any day):</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {workoutsDeck.length} available
                </span>
              </div>

              {/* Draggable Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                {workoutsDeck.map((w, idx) => {
                  const assignedDays = getAssignedDays(w.name, !!w.isRest);
                  const isAssigned = assignedDays.length > 0;

                  return (
                    <div
                      key={`${w.name}-${idx}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStartFromPool(e, w)}
                      title="Drag this workout to any day slot below"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-grab active:cursor-grabbing select-none group hover:scale-[1.02] active:scale-95 ${
                        w.isRest
                          ? "bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          : "bg-zinc-900 border-zinc-700/80 text-white hover:border-emerald-500/60 shadow-sm"
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-44">{w.name}</span>

                      {/* Day Assigned Badges */}
                      {isAssigned ? (
                        <div className="flex items-center gap-0.5 ml-1">
                          {assignedDays.map((d) => (
                            <span
                              key={d}
                              className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            >
                              {d.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-zinc-600 font-medium ml-1">
                          unassigned
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 7-Day Schedule Slots */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1 text-xs text-zinc-400">
                <span className="font-bold flex items-center gap-1.5 text-zinc-300">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>7-Day Schedule</span>
                </span>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Drag days to swap</span>
                </span>
              </div>

              <div className="space-y-1.5 max-h-90 overflow-y-auto pr-1">
                {routineDraft.map((day) => {
                  const dayCapitalized = day.dayOfWeek.charAt(0).toUpperCase() + day.dayOfWeek.slice(1);
                  const isOver = dragOverDay === day.dayOfWeek;

                  return (
                    <div
                      key={day.dayOfWeek}
                      onDragOver={(e) => handleDragOverSlot(e, day.dayOfWeek as DayOfWeekKey)}
                      onDragLeave={(e) => handleDragLeaveSlot(e, day.dayOfWeek as DayOfWeekKey)}
                      onDrop={(e) => handleDropOnSlot(e, day.dayOfWeek as DayOfWeekKey)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 relative ${
                        isOver
                          ? "border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/80 shadow-md shadow-emerald-500/20 scale-[1.01]"
                          : day.isRestDay
                          ? "bg-zinc-950/40 border-zinc-800/60"
                          : "bg-zinc-950/90 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {/* Day Label & Drag Grip to Swap */}
                      <div
                        draggable={true}
                        onDragStart={(e) => handleDragStartFromSlot(e, day)}
                        className="flex items-center gap-2 cursor-grab active:cursor-grabbing shrink-0 min-w-28 select-none group"
                        title="Drag this day onto another day to swap them"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-xs font-black text-white">{dayCapitalized}</span>
                      </div>

                      {/* Workout Name / Slot */}
                      <div className="flex-1 min-w-0">
                        {day.isRestDay ? (
                          <span className="text-xs font-semibold text-zinc-500 block truncate">
                            🌿 Rest & Recovery
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-300 block truncate">
                            {day.workoutName}
                          </span>
                        )}
                      </div>

                      {/* Rest Toggle Button */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateRoutineDay(
                            day.dayOfWeek as DayOfWeekKey,
                            day.isRestDay ? "Push Day" : "Rest & Recovery",
                            !day.isRestDay
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 ${
                          day.isRestDay
                            ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {day.isRestDay ? "🌿 Rest" : "Active"}
                      </button>

                      {/* Drag overlay feedback */}
                      {isOver && (
                        <div className="absolute inset-0 bg-emerald-500/15 backdrop-blur-xs rounded-xl flex items-center justify-center pointer-events-none border border-emerald-400">
                          <span className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
                            Drop to set {dayCapitalized}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Presets row */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
              <span className="text-[10px] font-semibold text-zinc-500 shrink-0">Presets:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SPLIT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-emerald-300 transition"
                  >
                    {preset.name.split(" (")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Save & Cancel Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setIsCustomizingRoutine(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSavingRoutine}
                onClick={handleSaveRoutine}
                className="px-5 py-2 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSavingRoutine ? "Saving..." : "Save Split"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. MODAL: SINGLE DAY WORKOUT DETAILS & RECORD REDIRECT */}
      {selectedDay && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDay(null)}
          size="lg"
          title={
            <div className="flex items-center justify-between w-full pr-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="font-extrabold">{selectedDay.dayName} Workout Plan</span>
              </div>
              {selectedDay.isCompletedThisWeek && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Logged This Week</span>
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-5">
            {/* Header Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  {selectedDay.isRestDay ? "Recovery Schedule" : "Assigned Training Session"}
                </span>
                {selectedDay.workoutId ? (
                  <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                    Saved Routine Sheet
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Weekly Split
                  </span>
                )}
              </div>
              <h4 className="text-lg font-black text-white">{selectedDay.workoutName}</h4>
              <p className="text-xs text-zinc-400">
                {selectedDay.isRestDay
                  ? "Scheduled as a rest & recovery day in your weekly split."
                  : `Planned session for ${selectedDay.dayName}. Follow your training routine.`}
              </p>

              {/* Target Muscle Badges */}
              {selectedDay.targetMuscleGroups && selectedDay.targetMuscleGroups.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-semibold text-zinc-400">Focus:</span>
                  {selectedDay.targetMuscleGroups.map((mg) => (
                    <span
                      key={mg}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    >
                      {mg}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exercises List if available */}
            {selectedDay.exercises && selectedDay.exercises.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Planned Exercises ({selectedDay.exercises.length})</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {selectedDay.targetSetsCount || selectedDay.exercises.reduce((s, e) => s + e.setsCount, 0)} Total Sets
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedDay.exercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{ex.name}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                            {ex.muscleGroup}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                          <span>{ex.setsCount || 3} Sets</span>
                          {ex.targetReps && <span>• {ex.targetReps} Reps</span>}
                          {ex.targetWeight && ex.targetWeight > 0 && (
                            <span>• {ex.targetWeight} {ex.weightUnit || "kg"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !selectedDay.isRestDay && (
              <div className="p-4 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center space-y-1.5">
                <p className="text-xs text-zinc-400">Scheduled training session: <span className="font-bold text-white">{selectedDay.workoutName}</span>.</p>
                <p className="text-[11px] text-zinc-500">Record your session stats or add specific gym exercises to this day.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-zinc-800/80">
              {!selectedDay.isRestDay && (
                <>
                  {selectedDay.workoutId ? (
                    <>
                      <Link
                        href={`/workouts/${selectedDay.workoutId}/active`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Gym Session</span>
                      </Link>

                      <Link
                        href={`/workouts/${selectedDay.workoutId}`}
                        className="py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs border border-zinc-700 flex items-center justify-center gap-1.5 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Edit Sheet</span>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/workouts/record?day=${selectedDay.dayOfWeek}`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition active:scale-95"
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                        <span>Record {selectedDay.workoutName}</span>
                      </Link>

                      <Link
                        href={`/workouts/new?day=${selectedDay.dayOfWeek}`}
                        className="py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs border border-zinc-700 flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Create Sheet</span>
                      </Link>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedDay(null);
                  handleOpenRoutineCustomizer();
                }}
                className="py-2.5 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs border border-zinc-800 transition"
              >
                Change Split
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default WeeklySplitMap;
