"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";
import {
  Dumbbell,
  Calendar,
  Clock,
  Flame,
  Trophy,
  Trash2,
  Play,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Activity,
  Layers,
  Edit3,
  Loader2,
  Share2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { deleteWorkoutAction } from "@/lib/fitness/actions";
import { cn } from "@/lib/utils";
import {
  SerializedWorkoutSession,
  SerializedExercise,
  SerializedSet,
} from "@/components/workout/GymSessionsClient";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), {
  ssr: false,
});

interface SessionDetailClientProps {
  session: SerializedWorkoutSession;
}

export function SessionDetailClient({ session }: SessionDetailClientProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const unit = session.weightUnit || "kg";

  // Date and Time Formatting
  const formatSessionDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isValid(d)) return format(d, "EEEE, MMMM d, yyyy");
      const rawD = new Date(dateStr);
      if (isValid(rawD)) return format(rawD, "EEEE, MMMM d, yyyy");
    } catch {
      // fallback
    }
    return dateStr;
  };

  const formatSessionTime = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isValid(d)) return format(d, "h:mm a");
      const rawD = new Date(dateStr);
      if (isValid(rawD)) return format(rawD, "h:mm a");
    } catch {
      // fallback
    }
    return "";
  };

  const sessionDateStr = formatSessionDate(session.date || session.startedAt || session.createdAt);
  const sessionTimeStr = formatSessionTime(session.startedAt || session.createdAt);
  const dayCapitalized = session.dayOfWeek
    ? session.dayOfWeek.charAt(0).toUpperCase() + session.dayOfWeek.slice(1)
    : "Saturday";

  const durationMins = session.durationSeconds
    ? Math.round(session.durationSeconds / 60)
    : null;

  // Compute Telemetry
  let totalSetsCount = 0;
  let completedSetsCount = 0;
  let totalWorkingSets = 0;
  let totalWarmupSets = 0;
  const prsList: { exerciseName: string; weight: number; reps: number; oneRM?: number | null }[] = [];
  const muscleSetsMap: Record<string, number> = {};

  session.exercises.forEach((ex) => {
    const mg = ex.muscleGroup || "Other";
    let exCompletedSets = 0;

    ex.sets.forEach((s) => {
      totalSetsCount++;
      if (s.isWarmup) totalWarmupSets++;
      else totalWorkingSets++;

      if (s.completedReps && s.weight) {
        completedSetsCount++;
        exCompletedSets++;
      }

      if (s.isPR) {
        prsList.push({
          exerciseName: ex.name,
          weight: s.weight || 0,
          reps: s.completedReps || 0,
          oneRM: ex.oneRM,
        });
      }
    });

    muscleSetsMap[mg] = (muscleSetsMap[mg] || 0) + exCompletedSets;
  });

  const completionPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteWorkoutAction(session._id);
      if (res.success) {
        router.push("/workouts/sessions");
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      const summaryText = `🏋️ ${session.name} (${sessionDateStr})\n📊 Total Volume: ${session.totalVolume.toLocaleString()} ${unit}\n🔥 Sets Completed: ${completedSetsCount}/${totalSetsCount}\n🏆 PRs Hit: ${prsList.length}`;
      navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-20">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/workouts/sessions"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Sessions</span>
        </Link>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold transition cursor-pointer"
            title="Copy session summary"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? "Copied!" : "Share Summary"}</span>
          </button>

          <Link
            href={`/workouts/${session._id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold transition"
            title="Edit Routine Template"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Routine</span>
          </Link>

          <Link
            href={`/workouts/${session._id}/active`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
            title="Open Live Logger"
          >
            <Play className="w-3.5 h-3.5 fill-zinc-950" />
            <span>Re-record / Logger</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-2xl bg-zinc-900 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition cursor-pointer"
            title="Delete Session"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hero Session Header Card */}
      <div className="p-6 sm:p-8 rounded-4xl bg-zinc-900/85 backdrop-blur-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
              <Dumbbell className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {session.name}
                </h1>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {dayCapitalized}
                </span>
                {session.status === "completed" && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>Completed Session</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium text-zinc-300">{sessionDateStr}</span>
                </div>
                {sessionTimeStr && (
                  <div className="flex items-center gap-1 text-zinc-500">
                    <span>•</span>
                    <span>{sessionTimeStr}</span>
                  </div>
                )}
                {durationMins && (
                  <div className="flex items-center gap-1.5 text-purple-300">
                    <span>•</span>
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span>{durationMins} minutes</span>
                  </div>
                )}
                {session.estimatedCalories > 0 && (
                  <div className="flex items-center gap-1.5 text-orange-300">
                    <span>•</span>
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span>{session.estimatedCalories} kcal</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Volume Metric Pill */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/70 border border-white/8 text-start sm:text-end shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Total Lifted Volume
            </span>
            <span className="text-3xl sm:text-4xl font-black text-emerald-400">
              {session.totalVolume.toLocaleString()}{" "}
              <span className="text-sm font-medium text-zinc-500">{unit}</span>
            </span>
          </div>
        </div>

        {/* 4 Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 border-t border-white/6">
          <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Exercises</span>
            <span className="text-xl sm:text-2xl font-extrabold text-white">
              {session.exercises.length}
            </span>
            <span className="text-[11px] text-zinc-400 block">Logged in session</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Sets Completion</span>
            <span className="text-xl sm:text-2xl font-extrabold text-white">
              {completedSetsCount}{" "}
              <span className="text-xs text-zinc-500 font-normal">/ {totalSetsCount}</span>
            </span>
            <span className="text-[11px] text-emerald-400 block">{completionPercent}% completed</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Working Sets</span>
            <span className="text-xl sm:text-2xl font-extrabold text-teal-400">
              {totalWorkingSets}
            </span>
            <span className="text-[11px] text-zinc-500 block">{totalWarmupSets} warmup sets</span>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/50 border border-white/5 space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">PR Milestones</span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-400">
              {prsList.length}
            </span>
            <span className="text-[11px] text-zinc-400 block">
              {prsList.length > 0 ? "New PRs smashed" : "No new PRs"}
            </span>
          </div>
        </div>

        {/* PRs Highlight Banner if any PR occurred */}
        {prsList.length > 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm text-amber-300">
                Personal Records Broken in this Session!
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {prsList.map((pr, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-zinc-950/80 border border-amber-500/20 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-bold text-white truncate">{pr.exerciseName}</span>
                  <span className="font-black text-amber-400 shrink-0">
                    {pr.weight} {unit} × {pr.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Muscle Group Distribution */}
        {Object.keys(muscleSetsMap).length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
              Targeted Muscle Volume
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(muscleSetsMap).map(([muscle, sets]) => (
                <div
                  key={muscle}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/70 border border-white/5 text-xs"
                >
                  <span className="font-semibold text-zinc-300">{muscle}:</span>
                  <span className="font-black text-emerald-400">{sets} sets</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exercise Breakdown List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Exercise & Set Logs</span>
          </h2>
          <span className="text-xs text-zinc-400">{session.exercises.length} Exercises Recorded</span>
        </div>

        {session.exercises.map((exercise, exIdx) => {
          const exUnit = exercise.weightUnit || unit;
          return (
            <div
              key={exercise.catalogId + exIdx}
              className="p-5 sm:p-6 rounded-3xl bg-zinc-900/85 backdrop-blur-2xl border border-white/10 space-y-4 shadow-lg"
            >
              {/* Exercise Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center">
                    {exIdx + 1}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-white">{exercise.name}</h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-white/5">
                      {exercise.muscleGroup}
                    </span>
                  </div>
                </div>

                {exercise.oneRM && exercise.oneRM > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Peak 1RM: {exercise.oneRM} {exUnit}</span>
                  </div>
                )}
              </div>

              {/* Sets Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="text-zinc-500 border-b border-white/6 text-[10px] uppercase font-bold">
                      <th className="py-2 ps-3 text-start">Set</th>
                      <th className="py-2 text-center">Type</th>
                      <th className="py-2 text-center">Weight Lifted</th>
                      <th className="py-2 text-center">Completed Reps</th>
                      <th className="py-2 text-center">Target</th>
                      <th className="py-2 text-center">Set Volume</th>
                      <th className="py-2 text-center">RPE</th>
                      <th className="py-2 text-center">Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {exercise.sets.map((set, sIdx) => {
                      const setVolume = (set.weight || 0) * (set.completedReps || 0);
                      return (
                        <tr
                          key={sIdx}
                          className={cn(
                            "transition-colors",
                            set.isPR ? "bg-amber-500/5 font-semibold" : ""
                          )}
                        >
                          <td className="py-2.5 ps-3 text-start font-bold text-zinc-300">
                            #{set.setNumber || sIdx + 1}
                          </td>
                          <td className="py-2.5 text-center">
                            {set.isWarmup ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                Warmup
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                Working
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center font-bold text-white">
                            {set.weight !== null ? `${set.weight} ${exUnit}` : "—"}
                          </td>
                          <td className="py-2.5 text-center font-bold text-white">
                            {set.completedReps !== null ? `${set.completedReps} reps` : "—"}
                          </td>
                          <td className="py-2.5 text-center text-zinc-400 text-[11px]">
                            {set.targetWeight ? `${set.targetWeight} ${exUnit}` : "—"} × {set.targetReps || "—"}
                          </td>
                          <td className="py-2.5 text-center font-bold text-emerald-400">
                            {setVolume > 0 ? `${setVolume.toLocaleString()} ${exUnit}` : "—"}
                          </td>
                          <td className="py-2.5 text-center">
                            {set.rpe ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                                RPE {set.rpe}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            {set.isPR ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                                <Trophy className="w-3 h-3 text-amber-400" />
                                <span>PR</span>
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {exercise.notes && (
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 text-xs text-zinc-400">
                  <strong className="text-zinc-300 me-1">Note:</strong> {exercise.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowDeleteModal(false)}
          size="sm"
          title={
            <div className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>Delete Gym Session</span>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300">
              Are you sure you want to delete <strong className="text-white">&quot;{session.name}&quot;</strong>? All recorded weights, reps, and set logs for this workout will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
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
                <span>Delete Session</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SessionDetailClient;
