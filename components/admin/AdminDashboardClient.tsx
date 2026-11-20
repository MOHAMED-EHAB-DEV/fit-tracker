"use client";

import React, { useRef, useState } from "react";
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
  Archive,
  RefreshCw,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/components/admin/api";
import { formatAdminDate, formatCompact, useAdminZone } from "@/components/admin/AdminZone";
import { formatDateString } from "@/lib/time";
import type { AdminStats } from "@/lib/admin/stats";
import type { AdminUserRow } from "@/lib/admin/users";

interface AdminDashboardClientProps {
  initialStats: AdminStats;
  initialRecentUsers: AdminUserRow[];
}

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}% of all users` : null);

export function AdminDashboardClient({ initialStats, initialRecentUsers }: AdminDashboardClientProps) {
  const timeZone = useAdminZone();
  const [stats, setStats] = useState(initialStats);
  const [recentUsers, setRecentUsers] = useState(initialRecentUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = async () => {
    if (busy.current) return;
    busy.current = true;
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await apiRequest<{ stats: AdminStats; recentUsers: AdminUserRow[] }>("/api/admin/stats");
      setStats(data.stats);
      setRecentUsers(data.recentUsers);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      busy.current = false;
      setIsRefreshing(false);
    }
  };

  const weekLabel = `since ${formatDateString(stats.week.start, { weekday: "short", month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            &ldquo;This week&rdquo; starts on {stats.week.weekStartDay} ({weekLabel}, {stats.week.timezone}).
          </p>
        </div>
        <Button
          type="button"
          variant="bordered"
          size="md"
          onClick={refresh}
          isLoading={isRefreshing}
          startContent={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          className="min-h-11"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          Could not refresh: {error}
        </p>
      )}

      <section aria-labelledby="stats-users">
        <h2 id="stats-users" className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" aria-hidden="true" /> Users
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatsCard label="Accounts" value={stats.users.total} icon={Users} />
          <StatsCard
            label="Signed up this week"
            value={stats.users.newThisWeek}
            delta={weekLabel}
            icon={TrendingUp}
            iconColor="text-sky-400"
            bgColor="bg-sky-500/10"
          />
          <StatsCard
            label="Profiles complete"
            value={stats.users.profileComplete}
            delta={percent(stats.users.profileComplete, stats.users.total)}
            icon={UserCheck}
            iconColor="text-emerald-400"
            bgColor="bg-emerald-500/10"
          />
          <StatsCard label="Active admins" value={stats.users.admins} icon={ShieldCheck} />
          <StatsCard
            label="Banned"
            value={stats.users.banned}
            icon={UserX}
            iconColor="text-red-400"
            bgColor="bg-red-500/10"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="stats-workouts">
          <h2 id="stats-workouts" className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Workouts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatsCard
              label="Completed workouts"
              value={stats.workouts.completedTotal}
              delta="all time"
              icon={Activity}
              iconColor="text-emerald-400"
              bgColor="bg-emerald-500/10"
            />
            <StatsCard
              label="Completed this week"
              value={stats.workouts.completedThisWeek}
              delta={`started ${weekLabel}`}
              icon={TrendingUp}
              iconColor="text-sky-400"
              bgColor="bg-sky-500/10"
            />
            <StatsCard
              label="In progress now"
              value={stats.workouts.inProgress}
              icon={Dumbbell}
              iconColor="text-orange-400"
              bgColor="bg-orange-500/10"
            />
          </div>
        </section>

        <section aria-labelledby="stats-nutrition">
          <h2 id="stats-nutrition" className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5" aria-hidden="true" /> Nutrition
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatsCard
              label="Meals logged"
              value={stats.meals.total}
              delta={`${stats.meals.loggedThisWeek.toLocaleString()} this week`}
              icon={UtensilsCrossed}
              iconColor="text-pink-400"
              bgColor="bg-pink-500/10"
            />
            <StatsCard
              label="Calories logged this week"
              value={formatCompact(stats.meals.caloriesThisWeek)}
              delta="kcal, all users"
              icon={Flame}
              iconColor="text-amber-400"
              bgColor="bg-amber-500/10"
            />
            <StatsCard
              label="Nutrition plans"
              value={stats.nutritionPlans.total}
              delta={`${stats.nutritionPlans.assigned.toLocaleString()} assigned to users`}
              icon={BookOpen}
              iconColor="text-teal-400"
              bgColor="bg-teal-500/10"
            />
          </div>
        </section>
      </div>

      <section aria-labelledby="stats-exercises">
        <h2 id="stats-exercises" className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
          <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Exercise catalog
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
          <StatsCard label="Available exercises" value={stats.exercises.active} delta="not archived" icon={Dumbbell} />
          <StatsCard
            label="Users' custom exercises"
            value={stats.exercises.custom}
            icon={Activity}
            iconColor="text-zinc-300"
            bgColor="bg-zinc-700/40"
          />
          <StatsCard
            label="Archived"
            value={stats.exercises.archived}
            icon={Archive}
            iconColor="text-zinc-300"
            bgColor="bg-zinc-700/40"
          />
        </div>
      </section>

      <section aria-labelledby="recent-users">
        <div className="flex items-center justify-between mb-3">
          <h2 id="recent-users" className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> Recently joined
          </h2>
          <Link
            href="/admin/users"
            className="inline-flex items-center min-h-11 text-sm text-violet-400 hover:text-violet-300 transition font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
          >
            View all users →
          </Link>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-x-auto">
          {recentUsers.length === 0 ? (
            <p className="text-center text-zinc-400 text-sm py-10">No users yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">User</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Role</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800/30 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="flex items-center gap-3 min-h-11 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        <span className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-zinc-200 text-sm truncate">{u.name}</span>
                          <span className="block text-xs text-zinc-400 truncate">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold uppercase text-zinc-300">{u.role}</td>
                    <td className="px-4 py-3 text-xs font-bold uppercase">
                      {u.isBanned ? (
                        <span className="text-red-400">Banned</span>
                      ) : u.isProfileComplete ? (
                        <span className="text-emerald-400">Profile complete</span>
                      ) : (
                        <span className="text-amber-400">Profile incomplete</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums">{formatAdminDate(u.createdAt, timeZone)}</td>
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
