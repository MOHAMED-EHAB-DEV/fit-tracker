"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Dumbbell } from "lucide-react";
import { SetData } from "@/components/workout/SetRow";
import { ActiveWorkoutHeader } from "@/components/workout/ActiveWorkoutHeader";
import { ActiveExerciseCard, ActiveExerciseItem } from "@/components/workout/ActiveExerciseCard";
import { ExerciseSearch } from "@/components/workout/ExerciseSearch";
import { useUser } from "@/context/UserContext";
import { WorkoutFloatingToolbar } from "@/components/workout/WorkoutFloatingToolbar";
import { calculateSessionDoneCalories } from "@/lib/fitness/workout-calories";

interface ActiveWorkoutSessionProps {
  initialWorkout: {
    id: string;
    name: string;
    dayOfWeek: string;
    weightUnit?: "kg" | "lbs";
    userWeightKg?: number;
    exercises: ActiveExerciseItem[];
  };
}

export function ActiveWorkoutSession({ initialWorkout }: ActiveWorkoutSessionProps) {
  const router = useRouter();
  const { user } = useUser();
  const userWeightKg = initialWorkout.userWeightKg || user?.fitnessProfile?.weightKg || 0;
  const [name] = useState(initialWorkout.name);
  const [dayOfWeek] = useState(initialWorkout.dayOfWeek);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">(initialWorkout.weightUnit || "kg");
  const [exercises, setExercises] = useState<ActiveExerciseItem[]>(initialWorkout.exercises);
  const [isSaving, setIsSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Floating toolbar scroll observer
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

  const handleAddSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      const workingSets = ex.sets.filter((s) => !s.isWarmup);
      const prevWorking = workingSets[workingSets.length - 1];
      const prevSet = ex.sets[ex.sets.length - 1];
      const newSet: SetData = {
        setNumber: ex.sets.length + 1,
        weight: prevWorking?.weight || prevSet?.weight || null,
        completedReps: prevWorking?.completedReps || prevSet?.completedReps || null,
        targetWeight: prevWorking?.targetWeight || prevWorking?.weight || prevSet?.targetWeight || 50,
        targetReps: prevWorking?.targetReps || prevWorking?.completedReps || prevSet?.targetReps || 10,
        rpe: prevWorking?.rpe || null,
        isWarmup: false,
        isPR: false,
        completedAt: null,
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
      const baseWeight = firstWorking?.targetWeight || firstWorking?.weight || 50;

      const newWarmupSet: SetData = {
        setNumber: 1,
        weight: null,
        completedReps: null,
        targetWeight:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].targetWeight || Math.round(baseWeight * 0.5)
            : Math.round(baseWeight * 0.5) || 20,
        targetReps:
          existingWarmups.length > 0
            ? existingWarmups[existingWarmups.length - 1].targetReps || 12
            : 12,
        rpe: null,
        isWarmup: true,
        isPR: false,
        completedAt: null,
      };

      const lastWarmupIdx = ex.sets.reduce((last, s, idx) => (s.isWarmup ? idx : last), -1);
      const newSets = [...ex.sets];
      newSets.splice(lastWarmupIdx + 1, 0, newWarmupSet);
      ex.sets = newSets.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      ex.isWarmup = true;
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

  const handleAddExercise = (exercise: {
    _id: string;
    name: string;
    primaryMuscle: string;
    metValue?: number;
  }) => {
    const newEx: ActiveExerciseItem = {
      catalogId: exercise._id,
      name: exercise.name,
      muscleGroup: exercise.primaryMuscle,
      metValue: exercise.metValue,
      weightUnit: "kg",
      isWarmup: false,
      sets: [
        {
          setNumber: 1,
          weight: null,
          completedReps: null,
          targetWeight: 50,
          targetReps: 10,
          rpe: null,
          isWarmup: false,
          isPR: false,
          completedAt: null,
        },
      ],
    };
    setExercises((prev) => [...prev, newEx]);
    setShowSearch(false);
  };

  const handleToggleExerciseUnit = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const current = updated[exerciseIndex].weightUnit || "kg";
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        weightUnit: current === "kg" ? "lbs" : "kg",
      };
      return updated;
    });
  };

  const handleToggleExerciseWarmup = (exerciseIndex: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      const ex = updated[exerciseIndex];
      const nextWarmup = !ex.isWarmup;
      ex.isWarmup = nextWarmup;

      // If activating warmup and no warmup set exists, insert a warmup set at the beginning
      if (nextWarmup && !ex.sets.some((s) => s.isWarmup)) {
        const firstWorking = ex.sets[0];
        const baseWeight = firstWorking?.targetWeight || firstWorking?.weight || 50;
        const warmupSet: SetData = {
          setNumber: 1,
          weight: null,
          completedReps: null,
          targetWeight: Math.round(baseWeight * 0.5) || 20,
          targetReps: 12,
          rpe: null,
          isWarmup: true,
          isPR: false,
          completedAt: null,
        };
        ex.sets = [warmupSet, ...ex.sets].map((s, idx) => ({ ...s, setNumber: idx + 1 }));
      }
      return updated;
    });
  };

  const handleDeleteExercise = (exerciseIndex: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
  };

  // Explicit save action: commits all sets to DB
  const handleFinishWorkout = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workouts/${initialWorkout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dayOfWeek,
          weightUnit,
          exercises,
          status: "completed",
        }),
      });

      if (res.ok) {
        router.push("/workouts");
        router.refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Live Calculations
  let totalVolumeKg = 0;
  let totalSetsCount = 0;
  let completedSetsCount = 0;

  exercises.forEach((ex) => {
    const isLbs = (ex.weightUnit || "kg") === "lbs";
    ex.sets.forEach((s) => {
      totalSetsCount++;
      if (s.completedAt || (s.weight && s.completedReps)) {
        completedSetsCount++;
        const setVol = (s.weight || 0) * (s.completedReps || 0);
        totalVolumeKg += isLbs ? setVol / 2.20462 : setVol;
      }
    });
  });

  const burnedCalories = calculateSessionDoneCalories(exercises, userWeightKg);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Telemetry Header with manual Save & Finish */}
      <div ref={headerRef}>
        <ActiveWorkoutHeader
          workoutId={initialWorkout.id}
          name={name}
          dayOfWeek={dayOfWeek}
          weightUnit={weightUnit}
          isSaving={isSaving}
          totalVolumeKg={totalVolumeKg}
          completedSetsCount={completedSetsCount}
          totalSetsCount={totalSetsCount}
          exercisesCount={exercises.length}
          burnedCalories={burnedCalories}
          onWeightUnitChange={setWeightUnit}
          onFinish={handleFinishWorkout}
        />
      </div>

      {/* Exercises Set Recording Cards */}
      <section className="space-y-4">
        {exercises.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-[28px] bg-zinc-900/40 backdrop-blur-xl space-y-3">
            <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200">No Exercises in this Session</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Add exercises to start recording your weights and reps in this gym session.
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
          exercises.map((exercise, exIdx) => (
            <ActiveExerciseCard
              key={exercise.catalogId + exIdx}
              exercise={exercise}
              index={exIdx}
              weightUnit={exercise.weightUnit || "kg"}
              onUpdateSet={(sIdx, data) => handleUpdateSet(exIdx, sIdx, data)}
              onAddSet={() => handleAddSet(exIdx)}
              onAddWarmupSet={() => handleAddWarmupSet(exIdx)}
              onDeleteSet={(sIdx) => handleDeleteSet(exIdx, sIdx)}
              onDeleteExercise={() => handleDeleteExercise(exIdx)}
              onToggleUnit={() => handleToggleExerciseUnit(exIdx)}
              onToggleWarmup={() => handleToggleExerciseWarmup(exIdx)}
            />
          ))
        )}

        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="w-full py-3.5 rounded-[22px] bg-zinc-900/90 hover:bg-zinc-800 text-emerald-400 text-xs font-bold border border-white/10 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Exercise to Session</span>
          </button>
        )}
      </section>

      {/* Floating Bottom Toolbar (Appears when scrolled past header) */}
      <WorkoutFloatingToolbar
        isVisible={showFloatingToolbar}
        isSaving={isSaving}
        statusText="Active Gym Session"
        addExerciseLabel="Add Exercise"
        onAddExercise={() => setShowSearch(true)}
        saveLabel="Save & Finish"
        discardLabel="Discard"
        discardTitle="Discard Gym Session?"
        discardDescription="Are you sure you want to discard this workout session? Any logged weights and completed sets will not be saved."
        onSave={handleFinishWorkout}
        onDiscard={() => {
          router.push(`/workouts/${initialWorkout.id}`);
        }}
      />

      {/* Catalog Search Modal */}
      {showSearch && (
        <ExerciseSearch
          onSelect={handleAddExercise}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

export default ActiveWorkoutSession;
