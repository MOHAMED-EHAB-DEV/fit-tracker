"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Dumbbell,
  UtensilsCrossed,
  Flame,
  ShieldCheck,
  TrendingUp,
  Activity,
  BookOpen,
  UserCheck,
  UserX,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { formatDistanceToNow } from "date-fns";

export interface AdminStats {
  users: {
    total: number;
    newThisWeek: number;
    admins: number;
    banned: number;
    profileComplete: number;
  };
  workouts: { total: number; thisWeek: number; completed: number };
  meals: { total: number; thisWeek: number; totalCaloriesLogged: number };
  exercises: { total: number; custom: number; global: number };
  nutritionPlans: { total: number };
}

export interface RecentUserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isProfileComplete: boolean;
  isBanned: boolean;
}

interface AdminDashboardClientProps {
  initialStats?: AdminStats | null;
  initialRecentUsers?: RecentUserItem[];
}

export function AdminDashboardClient({
  initialStats = null,
  initialRecentUsers = [],
}: AdminDashboardClientProps) {
  const [stats, setStats] = useState<AdminStats | null>(initialStats);
  const [recentUsers, setRecentUsers] = useState<RecentUserItem[]>(initialRecentUsers);
  const [isLoading, setIsLoading] = useState(!initialStats);

  useEffect(() => {
    if (!initialStats) {
      fetch("/api/admin/stats")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setStats(d.stats);
            setRecentUsers(d.recentUsers || []);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [initialStats]);

  const formatCalories = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">Live Overview</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Platform-wide metrics and recent activity</p>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Users Row */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" aria-hidden="true" /> Users
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatsCard
                label="Total Users"
                value={stats.users.total}
                delta={`${stats.users.newThisWeek} this week`}
                icon={Users}
                iconColor="text-violet-400"
                bgColor="bg-violet-500/10"
              />
              <StatsCard
                label="Profile Complete"
                value={stats.users.profileComplete}
                delta={`${Math.round((stats.users.profileComplete / Math.max(stats.users.total, 1)) * 100)}%`}
                icon={UserCheck}
                iconColor="text-emerald-400"
                bgColor="bg-emerald-500/10"
              />
              <StatsCard
                label="Admins"
                value={stats.users.admins}
                icon={ShieldCheck}
                iconColor="text-violet-400"
                bgColor="bg-violet-500/10"
              />
              <StatsCard
                label="Banned"
                value={stats.users.banned}
                icon={UserX}
                iconColor="text-red-400"
                bgColor="bg-red-500/10"
                deltaPositive={false}
              />
              <StatsCard
                label="New This Week"
                value={stats.users.newThisWeek}
                icon={TrendingUp}
                iconColor="text-sky-400"
                bgColor="bg-sky-500/10"
              />
            </div>
          </section>

          {/* Workouts + Meals Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-2">
                <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Workouts
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatsCard
                  label="Total Logged"
                  value={stats.workouts.total}
                  delta={`${stats.workouts.thisWeek} this week`}
                  icon={Dumbbell}
                  iconColor="text-orange-400"
                  bgColor="bg-orange-500/10"
                />
                <StatsCard
                  label="Completed"
                  value={stats.workouts.completed}
                  icon={Activity}
                  iconColor="text-emerald-400"
                  bgColor="bg-emerald-500/10"
                />
                <StatsCard
                  label="This Week"
                  value={stats.workouts.thisWeek}
                  icon={TrendingUp}
                  iconColor="text-sky-400"
                  bgColor="bg-sky-500/10"
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-2">
                <UtensilsCrossed className="w-3.5 h-3.5" aria-hidden="true" /> Nutrition
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatsCard
                  label="Meals Logged"
                  value={stats.meals.total}
                  delta={`${stats.meals.thisWeek} this week`}
                  icon={UtensilsCrossed}
                  iconColor="text-pink-400"
                  bgColor="bg-pink-500/10"
                />
                <StatsCard
                  label="Calories Tracked"
                  value={formatCalories(stats.meals.totalCaloriesLogged)}
                  icon={Flame}
                  iconColor="text-amber-400"
                  bgColor="bg-amber-500/10"
                />
                <StatsCard
                  label="Nutrition Plans"
                  value={stats.nutritionPlans.total}
                  icon={BookOpen}
                  iconColor="text-teal-400"
                  bgColor="bg-teal-500/10"
                />
              </div>
            </section>
          </div>

          {/* Exercises Row */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 mb-3 flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Exercise Catalog
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
              <StatsCard
                label="Total Exercises"
                value={stats.exercises.total}
                icon={Dumbbell}
                iconColor="text-violet-400"
                bgColor="bg-violet-500/10"
              />
              <StatsCard
                label="Global"
                value={stats.exercises.global}
                icon={BookOpen}
                iconColor="text-zinc-400"
                bgColor="bg-zinc-700/40"
              />
              <StatsCard
                label="Custom"
                value={stats.exercises.custom}
                icon={Activity}
                iconColor="text-violet-400"
                bgColor="bg-violet-500/10"
              />
            </div>
          </section>
        </>
      ) : (
        <p className="text-zinc-500 text-sm">Failed to load stats.</p>
      )}

      {/* Recent Users */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> Recently Joined
          </h2>
          <Link href="/admin/users" className="text-xs text-violet-400 hover:text-violet-300 transition font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded">
            View all →
          </Link>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800/60 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm py-10">No users yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u._id} className="border-b border-zinc-800/30 last:border-0 hover:bg-violet-500/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200 text-xs">{u.name}</p>
                          <p className="text-[10px] text-zinc-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        u.role === "admin"
                          ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                          : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">Banned</span>
                      ) : u.isProfileComplete ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">Incomplete</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums">
                      {u.createdAt ? formatDistanceToNow(new Date(u.createdAt), { addSuffix: true }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardClient;
