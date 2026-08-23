"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Dumbbell, Play } from "lucide-react";
import { DayOfWeek } from "@/lib/db/models/Workout";
import { RoutineBuilderHeader } from "@/components/workout/RoutineBuilderHeader";
import { RoutineExerciseCard, DefaultExerciseItem } from "@/components/workout/RoutineExerciseCard";
import { ExerciseSearch } from "@/components/workout/ExerciseSearch";
import { WorkoutFloatingToolbar } from "@/components/workout/WorkoutFloatingToolbar";

interface RoutineBuilderClientProps {
  initialWorkout: {
    id: string;
    name: string;
    dayOfWeek: DayOfWeek;
    weightUnit?: "kg" | "lbs";
    exercises: DefaultExerciseItem[];
  };
}

export function RoutineBuilderClient({ initialWorkout }: RoutineBuilderClientProps) {
  const router = useRouter();
  const [name, setName] = useState(initialWorkout.name);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialWorkout.dayOfWeek);
  const [exercises, setExercises] = useState<DefaultExerciseItem[]>(initialWorkout.exercises);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Floating toolbar observer
  const headerRef = useRef<HTMLDivElement>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating toolbar when header is scrolled past the top
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

  const handleDiscardChanges = () => {
    setName(initialWorkout.name);
    setDayOfWeek(initialWorkout.dayOfWeek);
    setExercises(initialWorkout.exercises);
    setHasUnsavedChanges(false);
  };

  // Manual save routine function
  const saveRoutine = useCallback(
    async (
      exs: DefaultExerciseItem[] = exercises,
      wName: string = name,
      wDay: DayOfWeek = dayOfWeek
    ) => {
      setIsSaving(true);
      try {
        const structuredExercises = exs.map((ex) => {
          const isWarmupActive = !!ex.isWarmup;
          const warmupSetsCount = isWarmupActive ? ex.warmupSets || 1 : 0;
          const workingSetsCount = ex.targetSets || 3;

          const setsList: any[] = [];
          let setIdx = 1;

          // 1. Generate Warmup sets if warmup is activated
          if (isWarmupActive && warmupSetsCount > 0) {
            const warmupReps = ex.warmupReps || 12;
            const warmupWeight =
              ex.warmupWeight !== undefined && ex.warmupWeight !== null
                ? ex.warmupWeight
                : ex.targetWeight
                ? Math.round(ex.targetWeight * 0.5)
                : 20;

            for (let i = 0; i < warmupSetsCount; i++) {
              setsList.push({
                setNumber: setIdx++,
                targetReps: warmupReps,
                targetWeight: warmupWeight,
                completedReps: null,
                weight: null,
                rpe: null,
                isWarmup: true,
                isPR: false,
                completedAt: null,
              });
            }
          }

          // 2. Generate Main Working sets
          for (let i = 0; i < workingSetsCount; i++) {
            setsList.push({
              setNumber: setIdx++,
              targetReps: ex.targetReps || 10,
              targetWeight: ex.targetWeight || 50,
              completedReps: null,
              weight: null,
              rpe: null,
              isWarmup: false,
              isPR: false,
              completedAt: null,
            });
          }

          return {
            catalogId: ex.catalogId,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            weightUnit: ex.weightUnit || "kg",
            isWarmup: isWarmupActive,
            warmupSets: isWarmupActive ? warmupSetsCount : null,
            warmupReps: isWarmupActive ? ex.warmupReps || 12 : null,
            warmupWeight:
              isWarmupActive
                ? ex.warmupWeight ?? (ex.targetWeight ? Math.round(ex.targetWeight * 0.5) : 20)
                : null,
            notes: ex.notes || null,
            sets: setsList,
          };
        });

        const res = await fetch(`/api/workouts/${initialWorkout.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: wName.trim() || "Workout Routine",
            dayOfWeek: wDay.toLowerCase(),
            exercises: structuredExercises,
          }),
        });

        if (res.ok) {
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Failed to save routine:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [initialWorkout.id, exercises, name, dayOfWeek]
  );

  const handleNameChange = (newName: string) => {
    setName(newName);
    setHasUnsavedChanges(true);
  };

  const handleDayOfWeekChange = (newDay: DayOfWeek) => {
    setDayOfWeek(newDay);
    setHasUnsavedChanges(true);
  };

  const handleAddDefaultExercise = (exercise: {
    _id: string;
    name: string;
    primaryMuscle: string;
  }) => {
    const newEx: DefaultExerciseItem = {
      catalogId: exercise._id,
      name: exercise.name,
      muscleGroup: exercise.primaryMuscle,
      targetSets: 3,
      targetReps: 10,
      targetWeight: 50,
      weightUnit: "kg",
      isWarmup: false,
    };
    const next = [...exercises, newEx];
    setExercises(next);
    setHasUnsavedChanges(true);
    setShowSearch(false);
  };

  const handleUpdateExercise = (index: number, updated: Partial<DefaultExerciseItem>) => {
    const next = [...exercises];
    next[index] = { ...next[index], ...updated };
    setExercises(next);
    setHasUnsavedChanges(true);
  };

  const handleDeleteExercise = (index: number) => {
    const next = exercises.filter((_, i) => i !== index);
    setExercises(next);
    setHasUnsavedChanges(true);
  };

  const handleDeleteWorkout = async () => {
    const res = await fetch(`/api/workouts/${initialWorkout.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/workouts");
      router.refresh();
    }
  };

  const totalPlannedSets = exercises.reduce(
    (sum, e) => sum + (e.targetSets || 3) + (e.isWarmup ? e.warmupSets || 1 : 0),
    0
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Routine Header with scroll observer */}
      <div ref={headerRef}>
        <RoutineBuilderHeader
          workoutId={initialWorkout.id}
          name={name}
          dayOfWeek={dayOfWeek}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          exercisesCount={exercises.length}
          totalPlannedSets={totalPlannedSets}
          onNameChange={handleNameChange}
          onDayOfWeekChange={handleDayOfWeekChange}
          onSave={() => saveRoutine(exercises, name, dayOfWeek)}
          onDelete={handleDeleteWorkout}
        />
      </div>

      {/* Default Exercises Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            <span>Default Exercises in Routine</span>
          </h2>

          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Default Exercise</span>
          </button>
        </div>

        {exercises.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-[28px] bg-zinc-900/40 backdrop-blur-xl space-y-3">
            <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200">No Default Exercises Added</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Add default exercises to configure your routine template. When in the gym, you will record actual weights and reps in the active gym session.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Exercise</span>
            </button>
          </div>
        ) : (
          exercises.map((exercise, idx) => (
            <RoutineExerciseCard
              key={exercise.catalogId + idx}
              exercise={exercise}
              index={idx}
              onUpdate={(data) => handleUpdateExercise(idx, data)}
              onDelete={() => handleDeleteExercise(idx)}
            />
          ))
        )}

        {exercises.length > 0 && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-emerald-400 text-xs font-bold border border-white/10 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Exercise</span>
            </button>

            <Link
              href={`/workouts/${initialWorkout.id}/active`}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Play className="w-4 h-4 fill-zinc-950" />
              <span>Start Gym Session</span>
            </Link>
          </div>
        )}
      </section>

      {/* Floating Bottom Toolbar (Appears when scrolled past header) */}
      <WorkoutFloatingToolbar
        isVisible={showFloatingToolbar}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        addExerciseLabel="Add Exercise"
        onAddExercise={() => setShowSearch(true)}
        saveLabel="Save Routine"
        discardLabel="Discard"
        discardTitle="Discard Routine Changes?"
        discardDescription="Are you sure you want to discard your changes? All unsaved routine adjustments will be reverted."
        onSave={() => saveRoutine(exercises, name, dayOfWeek)}
        onDiscard={handleDiscardChanges}
      />

      {/* Catalog Search Modal */}
      {showSearch && (
        <ExerciseSearch
          onSelect={handleAddDefaultExercise}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

export default RoutineBuilderClient;
