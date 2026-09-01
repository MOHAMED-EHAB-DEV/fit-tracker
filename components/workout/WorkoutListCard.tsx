"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, Calendar, Trash2, Loader2, Play, Edit3 } from "lucide-react";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), {
  ssr: false,
});

import { deleteWorkoutAction } from "@/lib/fitness/actions";

interface WorkoutListCardProps {
  workout: {
    id: string;
    name: string;
    dayOfWeek: string;
    weightUnit?: string;
    exercisesCount: number;
    totalVolume: number;
    estimatedCalories: number;
  };
}

export function WorkoutListCard({ workout }: WorkoutListCardProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dayCapitalized = workout.dayOfWeek
    ? workout.dayOfWeek.charAt(0).toUpperCase() + workout.dayOfWeek.slice(1)
    : "Saturday";

  const unit = workout.weightUnit || "kg";

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);

    try {
      const res = await deleteWorkoutAction(workout.id);
      if (res.success) {
        setShowConfirm(false);
      }
    } catch (err) {
      console.error("Failed to delete workout:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-[26px] bg-zinc-900/80 backdrop-blur-2xl border border-white/10 hover:border-white/20 transition-all shadow-xl group relative">
        <Link
          href={`/workouts/${workout.id}`}
          className="flex items-center gap-3.5 flex-1 min-w-0"
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-sm sm:text-base text-zinc-100 group-hover:text-white truncate">
                {workout.name}
              </h4>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0">
                {dayCapitalized}
              </span>
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-white/8">
                {unit}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Assigned to {dayCapitalized}</span>
              </div>
            </div>
          </div>
        </Link>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs text-zinc-400 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-white/6 flex-wrap sm:flex-nowrap">
          <div className="text-start sm:text-end">
            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Exercises</span>
            <span className="font-bold text-white text-xs sm:text-sm">{workout.exercisesCount}</span>
          </div>
          <div className="text-start sm:text-end">
            <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total Volume</span>
            <span className="font-bold text-emerald-400 text-xs sm:text-sm tabular-nums">{workout.totalVolume.toLocaleString()} {unit}</span>
          </div>

          {/* Quick Actions: Edit Routine, Record Gym Session, Delete */}
          <div className="flex items-center gap-1.5 sm:gap-2 ps-2 border-s border-white/6 shrink-0 ms-auto sm:ms-0">
            <Link
              href={`/workouts/${workout.id}/active`}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 shrink-0"
              title="Start recording gym session"
            >
              <Play className="w-3.5 h-3.5 fill-zinc-950" />
              <span>Record</span>
            </Link>

            <Link
              href={`/workouts/${workout.id}`}
              className="p-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition"
              title="Edit routine template"
              aria-label={`Edit routine ${workout.name}`}
            >
              <Edit3 className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirm(true);
              }}
              className="p-2 rounded-xl bg-zinc-950/80 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-zinc-500 hover:text-red-400 transition cursor-pointer"
              title="Delete this workout routine"
              aria-label={`Delete routine ${workout.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setShowConfirm(false)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>Delete Workout Routine</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <strong className="text-white">&quot;{workout.name}&quot;</strong> ({dayCapitalized})? This will remove this workout routine.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default WorkoutListCard;
