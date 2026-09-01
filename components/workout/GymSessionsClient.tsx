"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { format, parseISO, isValid } from "date-fns";
import {
  Dumbbell,
  Calendar,
  Clock,
  Flame,
  Trophy,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Play,
  Layers,
  Sparkles,
  CheckCircle2,
  Eye,
  Loader2,
  Activity,
  ArrowLeft,
  X,
  History,
} from "lucide-react";
import dynamic from "next/dynamic";
import { deleteWorkoutAction } from "@/lib/fitness/actions";
import { cn } from "@/lib/utils";

const Modal = dynamic(() => import("@/components/ui/Modal").then((mod) => mod.Modal), {
  ssr: false,
});

export interface SerializedSet {
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  completedReps: number | null;
  weight: number | null;
  rpe: number | null;
  isWarmup: boolean;
  isPR: boolean;
  completedAt: string | null;
  restSeconds: number | null;
}

export interface SerializedExercise {
  catalogId: string;
  name: string;
  muscleGroup: string;
  weightUnit?: "kg" | "lbs";
  isWarmup?: boolean;
  warmupSets?: number;
  warmupReps?: number;
  warmupWeight?: number | null;
  sets: SerializedSet[];
  notes?: string | null;
  oneRM?: number | null;
}

export interface SerializedWorkoutSession {
  _id: string;
  name: string;
  dayOfWeek: string;
  templateId?: string | null;
  status: "active" | "completed" | "abandoned";
  startedAt: string;
  completedAt?: string | null;
  durationSeconds?: number | null;
  weekStartDate: string;
  exercises: SerializedExercise[];
  weightUnit: "kg" | "lbs";
  totalVolume: number;
  estimatedCalories: number;
  date: string;
  createdAt: string;
}

interface GymSessionsClientProps {
  initialSessions: SerializedWorkoutSession[];
}

export function GymSessionsClient({ initialSessions }: GymSessionsClientProps) {
  const [sessions, setSessions] = useState<SerializedWorkoutSession[]>(initialSessions);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTimeframe, setSelectedTimeframe] = useState<"all" | "today" | "week" | "month">("all");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "volume" | "duration">("newest");
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});

  // Modal states
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<SerializedWorkoutSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SerializedWorkoutSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedSessionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    sessions.forEach((s) => {
      allExpanded[s._id] = true;
    });
    setExpandedSessionIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedSessionIds({});
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteWorkoutAction(sessionToDelete._id);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s._id !== sessionToDelete._id));
        setSessionToDelete(null);
        if (selectedSessionForModal?._id === sessionToDelete._id) {
          setSelectedSessionForModal(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete workout session:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to extract true session date
  const getSessionDateObj = (session: SerializedWorkoutSession): Date => {
    const dateStr = session.completedAt || session.date || session.startedAt || session.createdAt;
    try {
      const d = parseISO(dateStr);
      if (isValid(d)) return d;
      const rawD = new Date(dateStr);
      if (isValid(rawD)) return rawD;
    } catch {
      // fallback
    }
    return new Date();
  };

  // Compute Overall Telemetry
  const aggregateStats = useMemo(() => {
    let totalVolume = 0;
    let totalPRs = 0;
    let totalCompletedSets = 0;
    let totalDurationSeconds = 0;
    let sessionsWithDuration = 0;

    sessions.forEach((s) => {
      totalVolume += s.totalVolume || 0;
      if (s.durationSeconds && s.durationSeconds > 0) {
        totalDurationSeconds += s.durationSeconds;
        sessionsWithDuration++;
      }
      s.exercises.forEach((ex) => {
        ex.sets.forEach((set) => {
          if (set.isPR) totalPRs++;
          if (set.completedReps && set.weight) totalCompletedSets++;
        });
      });
    });

    const avgDurationMins =
      sessionsWithDuration > 0 ? Math.round(totalDurationSeconds / sessionsWithDuration / 60) : 0;

    return {
      totalSessions: sessions.length,
      totalVolume,
      totalPRs,
      totalCompletedSets,
      avgDurationMins,
    };
  }, [sessions]);

  // Filter and Sort Sessions (Strictly Latest-First by default)
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    return sessions
      .filter((session) => {
        const sessionDate = getSessionDateObj(session);

        // Search Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const nameMatch = session.name.toLowerCase().includes(query);
          const exerciseMatch = session.exercises.some(
            (ex) =>
              ex.name.toLowerCase().includes(query) ||
              ex.muscleGroup.toLowerCase().includes(query)
          );
          if (!nameMatch && !exerciseMatch) return false;
        }

        // Timeframe Recency Filter
        if (selectedTimeframe !== "all") {
          if (selectedTimeframe === "today") {
            if (sessionDate.toDateString() !== todayStr) return false;
          } else if (selectedTimeframe === "week") {
            const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7) return false;
          } else if (selectedTimeframe === "month") {
            const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 30) return false;
          }
        }

        // Day Filter
        if (selectedDay !== "all") {
          if ((session.dayOfWeek || "").toLowerCase() !== selectedDay.toLowerCase()) {
            return false;
          }
        }

        // Muscle Filter
        if (selectedMuscle !== "all") {
          const hasMuscle = session.exercises.some((ex) =>
            ex.muscleGroup.toLowerCase().includes(selectedMuscle.toLowerCase())
          );
          if (!hasMuscle) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = getSessionDateObj(a).getTime();
        const timeB = getSessionDateObj(b).getTime();

        if (sortBy === "newest") {
          return timeB - timeA;
        }
        if (sortBy === "oldest") {
          return timeA - timeB;
        }
        if (sortBy === "volume") {
          return (b.totalVolume || 0) - (a.totalVolume || 0);
        }
        if (sortBy === "duration") {
          return (b.durationSeconds || 0) - (a.durationSeconds || 0);
        }
        return 0;
      });
  }, [sessions, searchQuery, selectedTimeframe, selectedDay, selectedMuscle, sortBy]);

  const muscleGroupsList = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
  const daysList = [
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
  ];

  const formatSessionDate = (session: SerializedWorkoutSession) => {
    const d = getSessionDateObj(session);
    try {
      return format(d, "EEEE, MMMM d, yyyy");
    } catch {
      return session.date || session.startedAt;
    }
  };

  const formatSessionTime = (session: SerializedWorkoutSession) => {
    const d = getSessionDateObj(session);
    try {
      return format(d, "h:mm a");
    } catch {
      return "";
    }
  };

  const getRelativeTimeBadge = (session: SerializedWorkoutSession) => {
    const target = getSessionDateObj(session);
    const now = new Date();

    if (target.toDateString() === now.toDateString()) return "Today";

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (target.toDateString() === yesterday.toDateString()) return "Yesterday";

    const diffDays = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays < 7) return `${diffDays}d ago`;
    if (diffDays >= 7 && diffDays < 14) return `1w ago`;
    if (diffDays >= 14 && diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays >= 30) return format(target, "MMM d, yyyy");

    return null;
  };

  return (
    <div className="space-y-6 w-full max-w-[1800px] mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Link
              href="/workouts"
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition"
              title="Back to Weekly Routines"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Recorded Gym Sessions</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                {sessions.length} Logged
              </span>
            </h1>
          </div>
          <p className="text-sm text-zinc-400 ps-10">
            Chronological log of all recorded workouts across past days with weights, reps, volume, and PRs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Link
            href="/workouts"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-white/10 transition shadow-sm"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Routines</span>
          </Link>

          <Link
            href="/workouts/record"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Session</span>
          </Link>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Sessions
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Dumbbell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {aggregateStats.totalSessions}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            {aggregateStats.totalCompletedSets} total completed sets
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Lifted Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {aggregateStats.totalVolume.toLocaleString()}{" "}
            <span className="text-xs font-medium text-zinc-500">kg</span>
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Cumulative across all sessions
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Personal Records (PRs)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {aggregateStats.totalPRs}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Milestones & 1RM records hit
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Avg Session Length
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-300">
            {aggregateStats.avgDurationMins > 0 ? `${aggregateStats.avgDurationMins}m` : "45m"}
          </div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">
            Average recorded gym time
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute inset-s-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by workout name, exercise, or muscle group..."
              className="w-full ps-10 pe-9 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2.5 rounded-2xl bg-zinc-950/80 border border-white/10 text-zinc-200 text-xs font-semibold focus:outline-none focus:border-emerald-500/60 cursor-pointer"
            >
              <option value="newest">Latest Recorded First</option>
              <option value="oldest">Oldest First</option>
              <option value="volume">Highest Volume</option>
              <option value="duration">Longest Duration</option>
            </select>

            <div className="flex items-center gap-1 ms-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 text-[11px] font-bold border border-white/5 transition cursor-pointer"
                title="Expand all session logs"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 text-[11px] font-bold border border-white/5 transition cursor-pointer"
                title="Collapse all session logs"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills (Timeframe, Days & Muscles) */}
        <div className="space-y-2.5 pt-2 border-t border-white/6">
          {/* Timeframe / Recency filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 me-1 shrink-0 flex items-center gap-1">
              <History className="w-3.5 h-3.5" />
              <span>Timeframe:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTimeframe("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedTimeframe === "all"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              All Recorded Sessions
            </button>
            <button
              type="button"
              onClick={() => setSelectedTimeframe("today")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedTimeframe === "today"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedTimeframe("week")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedTimeframe === "week"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              Past 7 Days
            </button>
            <button
              type="button"
              onClick={() => setSelectedTimeframe("month")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedTimeframe === "month"
                  ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              Past 30 Days
            </button>
          </div>

          {/* Muscle group filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 me-1 shrink-0">
              Muscle:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMuscle("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedMuscle === "all"
                  ? "bg-teal-500 text-zinc-950 shadow-md shadow-teal-500/20"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              All Muscles
            </button>
            {muscleGroupsList.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMuscle(m)}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                  selectedMuscle.toLowerCase() === m.toLowerCase()
                    ? "bg-teal-500 text-zinc-950 shadow-md shadow-teal-500/20"
                    : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Day of week filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 me-1 shrink-0">
              Day:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDay("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                selectedDay === "all"
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
              )}
            >
              All Days
            </button>
            {daysList.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDay(day.key)}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold text-xs transition shrink-0 cursor-pointer",
                  selectedDay === day.key
                    ? "bg-zinc-700 text-white shadow-xs"
                    : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-white/5"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Session Cards List */}
      <div className="space-y-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16 px-4 border border-dashed border-white/10 rounded-4xl bg-zinc-900/40 backdrop-blur-xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-white/10 text-zinc-500 flex items-center justify-center mx-auto">
              <Dumbbell className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">No Recorded Gym Sessions Found</h3>
              <p className="text-xs text-zinc-400">
                {sessions.length === 0
                  ? "You haven't recorded any gym sessions yet. Start a session or log your completed workout weights."
                  : "No recorded sessions match your current search and filter criteria. Try resetting filters."}
              </p>
            </div>
            {sessions.length === 0 ? (
              <Link
                href="/workouts/record"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Record First Session</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedTimeframe("all");
                  setSelectedDay("all");
                  setSelectedMuscle("all");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition cursor-pointer"
              >
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isExpanded = !!expandedSessionIds[session._id];
            const sessionDateFormatted = formatSessionDate(session);
            const sessionTimeFormatted = formatSessionTime(session);
            const relativeBadge = getRelativeTimeBadge(session);

            // Compute session statistics
            let completedSetsCount = 0;
            let totalSetsCount = 0;
            let prCount = 0;

            session.exercises.forEach((ex) => {
              ex.sets.forEach((s) => {
                totalSetsCount++;
                if (s.completedReps && s.weight) completedSetsCount++;
                if (s.isPR) prCount++;
              });
            });

            const dayCapitalized = session.dayOfWeek
              ? session.dayOfWeek.charAt(0).toUpperCase() + session.dayOfWeek.slice(1)
              : "Saturday";

            const unit = session.weightUnit || "kg";
            const durationMins = session.durationSeconds
              ? Math.round(session.durationSeconds / 60)
              : null;

            return (
              <div
                key={session._id}
                className="rounded-[28px] bg-zinc-900/85 backdrop-blur-2xl border border-white/10 hover:border-white/20 transition-all shadow-xl overflow-hidden group"
              >
                {/* Session Card Header Bar */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Title & Metadata */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Dumbbell className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/workouts/sessions/${session._id}`}
                            className="font-extrabold text-base sm:text-lg text-white hover:text-emerald-400 transition truncate"
                          >
                            {session.name}
                          </Link>

                          {/* Relative / Exact Date Badge */}
                          {relativeBadge && (
                            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shrink-0 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-400" />
                              <span>{relativeBadge}</span>
                            </span>
                          )}

                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-zinc-800 border border-white/8 text-zinc-400 shrink-0">
                            {dayCapitalized}
                          </span>

                          {session.status === "completed" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-teal-400" />
                              <span>Completed</span>
                            </span>
                          )}
                          {prCount > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center gap-1 shrink-0">
                              <Trophy className="w-3 h-3 text-amber-400" />
                              <span>{prCount} PR{prCount > 1 ? "s" : ""}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-zinc-300 font-medium">{sessionDateFormatted}</span>
                          </div>
                          {sessionTimeFormatted && (
                            <div className="flex items-center gap-1 text-zinc-400">
                              <span>•</span>
                              <span>{sessionTimeFormatted}</span>
                            </div>
                          )}
                          {durationMins && (
                            <div className="flex items-center gap-1 text-purple-300">
                              <span>•</span>
                              <Clock className="w-3.5 h-3.5 text-purple-400" />
                              <span>{durationMins} min</span>
                            </div>
                          )}
                          {session.estimatedCalories > 0 && (
                            <div className="flex items-center gap-1 text-orange-300">
                              <span>•</span>
                              <Flame className="w-3.5 h-3.5 text-orange-400" />
                              <span>{session.estimatedCalories} kcal</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* High-level telemetry summary */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-zinc-400 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/6">
                      <div className="text-start sm:text-end bg-zinc-950/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-xl sm:rounded-none">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Exercises</span>
                        <span className="font-extrabold text-white text-sm sm:text-base">
                          {session.exercises.length}
                        </span>
                      </div>

                      <div className="text-start sm:text-end bg-zinc-950/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-xl sm:rounded-none">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Sets Done</span>
                        <span className="font-extrabold text-white text-sm sm:text-base">
                          {completedSetsCount} <span className="text-xs text-zinc-500 font-normal">/ {totalSetsCount}</span>
                        </span>
                      </div>

                      <div className="text-start sm:text-end bg-zinc-950/60 sm:bg-transparent px-3 py-2 sm:p-0 rounded-xl sm:rounded-none">
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total Volume</span>
                        <span className="font-extrabold text-emerald-400 text-sm sm:text-base">
                          {session.totalVolume.toLocaleString()} <span className="text-xs font-normal text-zinc-500">{unit}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 ps-2 border-s border-white/6">
                        {/* Quick View Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedSessionForModal(session)}
                          className="p-2 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-white/8 text-zinc-400 hover:text-white transition cursor-pointer"
                          title="Quick view session breakdown"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Full Detail Page */}
                        <Link
                          href={`/workouts/sessions/${session._id}`}
                          className="p-2 rounded-xl bg-zinc-950/60 hover:bg-emerald-500/15 border border-white/8 hover:border-emerald-500/30 text-zinc-400 hover:text-emerald-300 transition"
                          title="View complete session telemetry & analysis"
                        >
                          <Sparkles className="w-4 h-4" />
                        </Link>

                        {/* Delete Session */}
                        <button
                          type="button"
                          onClick={() => setSessionToDelete(session)}
                          className="p-2 rounded-xl bg-zinc-950/60 hover:bg-red-500/15 border border-white/8 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition cursor-pointer"
                          title="Delete recorded session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Expand / Collapse Accordion */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(session._id)}
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                          title={isExpanded ? "Collapse sets" : "Expand sets"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Muscle Tags Preview Strip */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {Array.from(new Set(session.exercises.map((e) => e.muscleGroup).filter(Boolean))).map((mg) => (
                      <span
                        key={mg}
                        className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-zinc-950/60 border border-white/5 text-zinc-400"
                      >
                        {mg}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expanded Exercises & Sets Breakdown */}
                {isExpanded && (
                  <div className="px-5 pb-6 pt-2 border-t border-white/6 space-y-4 bg-zinc-950/40">
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Logged Exercises & Sets</span>
                      </span>
                      <Link
                        href={`/workouts/sessions/${session._id}`}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <span>Open Full Session Report</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>

                    {session.exercises.map((exercise, exIdx) => {
                      const exUnit = exercise.weightUnit || unit;
                      return (
                        <div
                          key={exercise.catalogId + exIdx}
                          className="p-4 rounded-2xl bg-zinc-900/90 border border-white/8 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center justify-center">
                                {exIdx + 1}
                              </span>
                              <h4 className="font-bold text-sm text-white">{exercise.name}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 font-semibold">
                                {exercise.muscleGroup}
                              </span>
                            </div>

                            {exercise.oneRM && exercise.oneRM > 0 && (
                              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>1RM: {exercise.oneRM} {exUnit}</span>
                              </span>
                            )}
                          </div>

                          {/* Sets Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-start">
                              <thead>
                                <tr className="text-zinc-500 border-b border-white/6 text-[10px] uppercase font-bold">
                                  <th className="py-1.5 ps-2 text-start">Set</th>
                                  <th className="py-1.5 text-center">Type</th>
                                  <th className="py-1.5 text-center">Logged Weight</th>
                                  <th className="py-1.5 text-center">Logged Reps</th>
                                  <th className="py-1.5 text-center">Target</th>
                                  <th className="py-1.5 text-center">RPE</th>
                                  <th className="py-1.5 text-center">Record</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/4">
                                {exercise.sets.map((set, sIdx) => {
                                  return (
                                    <tr
                                      key={sIdx}
                                      className={cn(
                                        "transition-colors",
                                        set.isPR ? "bg-amber-500/5 font-semibold" : ""
                                      )}
                                    >
                                      <td className="py-2 ps-2 text-start font-bold text-zinc-300">
                                        #{set.setNumber || sIdx + 1}
                                      </td>
                                      <td className="py-2 text-center">
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
                                      <td className="py-2 text-center font-bold text-white">
                                        {set.weight !== null ? `${set.weight} ${exUnit}` : "—"}
                                      </td>
                                      <td className="py-2 text-center font-bold text-white">
                                        {set.completedReps !== null ? `${set.completedReps} reps` : "—"}
                                      </td>
                                      <td className="py-2 text-center text-zinc-400 text-[11px]">
                                        {set.targetWeight ? `${set.targetWeight} ${exUnit}` : "—"} × {set.targetReps || "—"}
                                      </td>
                                      <td className="py-2 text-center">
                                        {set.rpe ? (
                                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5">
                                            RPE {set.rpe}
                                          </span>
                                        ) : (
                                          <span className="text-zinc-600">—</span>
                                        )}
                                      </td>
                                      <td className="py-2 text-center">
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

                          {/* Exercise Notes if available */}
                          {exercise.notes && (
                            <p className="text-[11px] text-zinc-400 italic bg-zinc-950/60 p-2.5 rounded-xl border border-white/5">
                              Note: {exercise.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Session Details Modal */}
      {selectedSessionForModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedSessionForModal(null)}
          size="lg"
          title={
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  {selectedSessionForModal.name}
                </h3>
                <span className="text-xs text-zinc-400 font-normal">
                  {formatSessionDate(selectedSessionForModal)}
                </span>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-zinc-950/80 border border-white/8 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Total Volume</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {selectedSessionForModal.totalVolume.toLocaleString()} {selectedSessionForModal.weightUnit}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Exercises</span>
                <span className="text-base font-extrabold text-white">
                  {selectedSessionForModal.exercises.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Estimated Burn</span>
                <span className="text-base font-extrabold text-orange-400">
                  {selectedSessionForModal.estimatedCalories || 0} kcal
                </span>
              </div>
            </div>

            {/* Exercises Log */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Exercise Set Breakdown
              </h4>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pe-1">
                {selectedSessionForModal.exercises.map((ex, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">
                        {idx + 1}. {ex.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {ex.muscleGroup}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                      {ex.sets.map((s, sIdx) => (
                        <div
                          key={sIdx}
                          className={cn(
                            "p-2 rounded-lg border text-center",
                            s.isPR
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                              : "bg-zinc-900 border-white/5 text-zinc-300"
                          )}
                        >
                          <div className="text-[10px] text-zinc-500">Set {s.setNumber || sIdx + 1}</div>
                          <div className="font-black text-white">
                            {s.weight ?? "—"} {selectedSessionForModal.weightUnit} × {s.completedReps ?? "—"}
                          </div>
                          {s.isPR && <div className="text-[9px] font-bold text-amber-400">PR Hit</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/8">
              <Link
                href={`/workouts/${selectedSessionForModal._id}/active`}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-zinc-950" />
                <span>Open Gym Session Recorder</span>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setSessionToDelete(null)}
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
              Are you sure you want to delete <strong className="text-white">&quot;{sessionToDelete.name}&quot;</strong>? All logged sets, volume, and recorded weights from this session will be permanently deleted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
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

export default GymSessionsClient;
