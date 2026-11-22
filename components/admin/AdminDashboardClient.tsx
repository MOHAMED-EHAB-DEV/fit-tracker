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
          <h1 className="text-3xl font-semibold text-ink tracking-tight">Admin dashboard</h1>
          <p className="text-ink-2 text-sm mt-1">
            &ldquo;This week&rdquo; starts on {stats.week.weekStartDay.charAt(0).toUpperCase() + stats.week.weekStartDay.slice(1)} ({weekLabel}, {stats.week.timezone}).
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
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
        <p role="alert" className="text-sm text-danger bg-surface border border-line rounded-control p-3">
          Could not refresh: {error}
        </p>
      )}

      <section aria-labelledby="stats-users">
        <h2 id="stats-users" className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" aria-hidden="true" /> Users
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatsCard label="Accounts" value={stats.users.total} icon={Users} />
          <StatsCard
            label="Signed up this week"
            value={stats.users.newThisWeek}
            delta={weekLabel}
            icon={TrendingUp}
          />
          <StatsCard
            label="Profiles complete"
            value={stats.users.profileComplete}
            delta={percent(stats.users.profileComplete, stats.users.total)}
            icon={UserCheck}
          />
          <StatsCard label="Active admins" value={stats.users.admins} icon={ShieldCheck} />
          <StatsCard
            label="Banned"
            value={stats.users.banned}
            icon={UserX}
            alertWhenPositive
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="stats-workouts">
          <h2 id="stats-workouts" className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-2">
            <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Workouts
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatsCard
              label="Completed workouts"
              value={stats.workouts.completedTotal}
              delta="all time"
              icon={Activity}
            />
            <StatsCard
              label="Completed this week"
              value={stats.workouts.completedThisWeek}
              delta={`started ${weekLabel}`}
              icon={TrendingUp}
            />
            <StatsCard
              label="In progress now"
              value={stats.workouts.inProgress}
              icon={Dumbbell}
            />
          </div>
        </section>

        <section aria-labelledby="stats-nutrition">
          <h2 id="stats-nutrition" className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-2">
            <UtensilsCrossed className="w-3.5 h-3.5" aria-hidden="true" /> Nutrition
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatsCard
              label="Meals logged"
              value={stats.meals.total}
              delta={`${stats.meals.loggedThisWeek.toLocaleString()} this week`}
              icon={UtensilsCrossed}
            />
            <StatsCard
              label="Calories logged this week"
              value={formatCompact(stats.meals.caloriesThisWeek)}
              delta="kcal, all users"
              icon={Flame}
            />
            <StatsCard
              label="Nutrition plans"
              value={stats.nutritionPlans.total}
              delta={`${stats.nutritionPlans.assigned.toLocaleString()} assigned to users`}
              icon={BookOpen}
            />
          </div>
        </section>
      </div>

      <section aria-labelledby="stats-exercises">
        <h2 id="stats-exercises" className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-2">
          <Dumbbell className="w-3.5 h-3.5" aria-hidden="true" /> Exercise catalog
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-xl">
          <StatsCard label="Available exercises" value={stats.exercises.active} delta="not archived" icon={Dumbbell} />
          <StatsCard
            label="Users' custom exercises"
            value={stats.exercises.custom}
            icon={Activity}
          />
          <StatsCard
            label="Archived"
            value={stats.exercises.archived}
            icon={Archive}
          />
        </div>
      </section>

      <section aria-labelledby="recent-users">
        <div className="flex items-center justify-between mb-3">
          <h2 id="recent-users" className="text-xs font-semibold text-ink-2 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> Recently joined
          </h2>
          <Link
            href="/admin/users"
            className="inline-flex items-center min-h-11 text-sm text-ink-2 hover:text-ink-2 transition font-medium rounded"
          >
            View all users →
          </Link>
        </div>
        <div className="bg-surface border border-line rounded-card overflow-x-auto">
          {recentUsers.length === 0 ? (
            <p className="text-center text-ink-2 text-sm py-10">No users yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2">User</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2">Role</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="flex items-center gap-3 min-h-11 rounded"
                      >
                        <span className="w-8 h-8 rounded-full bg-elevated border border-line text-ink-2 flex items-center justify-center font-semibold text-xs shrink-0" aria-hidden="true">
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-ink text-sm truncate">{u.name}</span>
                          <span className="block text-xs text-ink-2 truncate">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-ink-2">{u.role}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {u.isBanned ? (
                        <span className="text-danger">Banned</span>
                      ) : u.isProfileComplete ? (
                        <span className="text-ink">Profile complete</span>
                      ) : (
                        <span className="text-warn">Profile incomplete</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-2 tabular-nums">{formatAdminDate(u.createdAt, timeZone)}</td>
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
