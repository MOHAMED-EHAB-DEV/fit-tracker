"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Dumbbell,
  UtensilsCrossed,
  Scale,
  ShieldCheck,
  Shield,
  Ban,
  CheckCircle,
  Trash2,
  Save,
  Activity,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { formatDistanceToNow, format } from "date-fns";
import {
  SEX_OPTIONS,
  FITNESS_GOAL_KEYS,
  ACTIVITY_LEVEL_KEYS,
} from "@/constants/user";

export interface UserDetail {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isBanned: boolean;
  isProfileComplete: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  fitnessProfile: {
    sex: string | null;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    activityLevel: string | null;
    goal: string | null;
    targetCalories: number | null;
    targetProteinG: number | null;
  };
  preferences: {
    stepGoal: number | null;
    waterGoalMl: number | null;
    timezone: string;
    weightUnit: string;
  };
  computed: { bmr: number | null; tdee: number | null };
}

export interface UserStats {
  workoutCount: number;
  mealCount: number;
  bodyCompCount: number;
}

interface AdminUserDetailClientProps {
  id: string;
  initialUser?: UserDetail | null;
  initialStats?: UserStats | null;
}

export function AdminUserDetailClient({
  id,
  initialUser = null,
  initialStats = null,
}: AdminUserDetailClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(initialUser);
  const [stats, setStats] = useState<UserStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [isSaving, setIsSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [hasEdits, setHasEdits] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    type: "delete" | "ban" | "unban" | "promote" | "demote";
    isLoading: boolean;
  }>({ open: false, type: "delete", isLoading: false });

  useEffect(() => {
    if (!initialUser) {
      fetch(`/api/admin/users/${id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setUser(d.user);
            setStats(d.stats);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, initialUser]);

  const handleEdit = (key: string, value: any) => {
    setEdits((p) => ({ ...p, [key]: value }));
    setHasEdits(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setEdits({});
        setHasEdits(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalAction = async () => {
    setModal((m) => ({ ...m, isLoading: true }));
    try {
      if (modal.type === "delete") {
        await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
        router.push("/admin/users");
        return;
      }
      const patchBody =
        modal.type === "ban"
          ? { isBanned: true }
          : modal.type === "unban"
          ? { isBanned: false }
          : modal.type === "promote"
          ? { role: "admin" }
          : { role: "user" };
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json();
      if (data.success) setUser(data.user);
      setModal({ open: false, type: "delete", isLoading: false });
    } catch {
      setModal((m) => ({ ...m, isLoading: false }));
    }
  };

  if (isLoading)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded-xl w-48" />
        <div className="h-40 bg-zinc-900 rounded-2xl" />
      </div>
    );
  if (!user)
    return (
      <div className="text-center py-20">
        <p className="text-zinc-500 text-sm">User not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-violet-400 text-sm hover:underline cursor-pointer"
        >
          Go back
        </button>
      </div>
    );

  const modalConfig = {
    delete: {
      title: "Delete User",
      message: `Delete "${user.name}" and all their data permanently?`,
      confirmLabel: "Delete",
      confirmVariant: "danger" as const,
    },
    ban: {
      title: "Ban User",
      message: `Ban "${user.name}"?`,
      confirmLabel: "Ban",
      confirmVariant: "danger" as const,
    },
    unban: {
      title: "Unban User",
      message: `Restore access for "${user.name}"?`,
      confirmLabel: "Unban",
      confirmVariant: "primary" as const,
    },
    promote: {
      title: "Promote to Admin",
      message: `Grant admin access to "${user.name}"?`,
      confirmLabel: "Promote",
      confirmVariant: "primary" as const,
    },
    demote: {
      title: "Revoke Admin",
      message: `Remove admin from "${user.name}"?`,
      confirmLabel: "Revoke",
      confirmVariant: "warning" as const,
    },
  };

  const Field = ({
    label,
    field,
    value,
    type = "text",
    options,
  }: {
    label: string;
    field: string;
    value: any;
    type?: string;
    options?: string[];
  }) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 select-none">
        {label}
      </label>
      {options ? (
        <select
          value={edits[field] !== undefined ? edits[field] : value ?? ""}
          onChange={(e) => handleEdit(field, e.target.value || null)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 min-h-[40px] text-sm text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition cursor-pointer"
        >
          <option value="">Not set</option>
          {options.map((o) => (
            <option key={o} value={o} className="capitalize">
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={edits[field] !== undefined ? edits[field] : value ?? ""}
          onChange={(e) =>
            handleEdit(
              field,
              type === "number"
                ? e.target.value
                  ? Number(e.target.value)
                  : null
                : e.target.value
            )
          }
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 min-h-[40px] text-sm text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
          <p className="text-zinc-500 text-sm font-mono">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasEdits && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              aria-busy={isSaving}
              className="flex items-center gap-2 px-4 py-2 min-h-[40px] bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 transition disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{isSaving ? "Saving…" : "Save Changes"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              setModal({
                open: true,
                type: user.isBanned ? "unban" : "ban",
                isLoading: false,
              })
            }
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={user.isBanned ? "Unban user" : "Ban user"}
            aria-label={user.isBanned ? "Unban user" : "Ban user"}
          >
            {user.isBanned ? (
              <CheckCircle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Ban className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              setModal({
                open: true,
                type: user.role === "admin" ? "demote" : "promote",
                isLoading: false,
              })
            }
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            title={user.role === "admin" ? "Demote to user" : "Promote to admin"}
            aria-label={user.role === "admin" ? "Demote to user" : "Promote to admin"}
          >
            {user.role === "admin" ? (
              <Shield className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setModal({ open: true, type: "delete", isLoading: false })}
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            title="Delete user"
            aria-label="Delete user"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Workouts",
            value: stats?.workoutCount ?? 0,
            icon: Dumbbell,
            color: "text-orange-400",
            bg: "bg-orange-500/10",
          },
          {
            label: "Meals",
            value: stats?.mealCount ?? 0,
            icon: UtensilsCrossed,
            color: "text-pink-400",
            bg: "bg-pink-500/10",
          },
          {
            label: "Check-ins",
            value: stats?.bodyCompCount ?? 0,
            icon: Scale,
            color: "text-teal-400",
            bg: "bg-teal-500/10",
          },
          {
            label: "BMR",
            value: user.computed?.bmr ? `${user.computed.bmr} kcal` : "—",
            icon: Activity,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4"
          >
            <div
              className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}
            >
              <c.icon className={`w-4 h-4 ${c.color}`} aria-hidden="true" />
            </div>
            <p className="text-xl font-bold text-white tabular-nums">
              {typeof c.value === "number" ? c.value.toLocaleString() : c.value}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
            user.role === "admin"
              ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
              : "bg-zinc-800 text-zinc-500 border-zinc-700"
          }`}
        >
          <ShieldCheck className="w-3 h-3 inline mr-1" aria-hidden="true" />
          {user.role}
        </span>
        {user.isBanned && (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
            Banned
          </span>
        )}
        {user.isProfileComplete && (
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Profile Complete
          </span>
        )}
        <span className="px-3 py-1 rounded-full text-xs text-zinc-500 border border-zinc-800 tabular-nums">
          Joined {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
        </span>
        {user.lastLoginAt && (
          <span className="px-3 py-1 rounded-full text-xs text-zinc-500 border border-zinc-800 tabular-nums">
            Last login{" "}
            {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
          </span>
        )}
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-violet-400" aria-hidden="true" />
          <h2 className="text-base font-bold text-white">Fitness Profile</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Name" field="name" value={user.name} />
          <Field
            label="Sex"
            field="fitnessProfile.sex"
            value={user.fitnessProfile?.sex}
            options={SEX_OPTIONS.map((s) => s.value)}
          />
          <Field
            label="Goal"
            field="fitnessProfile.goal"
            value={user.fitnessProfile?.goal}
            options={FITNESS_GOAL_KEYS}
          />
          <Field
            label="Activity Level"
            field="fitnessProfile.activityLevel"
            value={user.fitnessProfile?.activityLevel}
            options={ACTIVITY_LEVEL_KEYS}
          />
          <Field
            label="Weight (kg)"
            field="fitnessProfile.weightKg"
            value={user.fitnessProfile?.weightKg}
            type="number"
          />
          <Field
            label="Height (cm)"
            field="fitnessProfile.heightCm"
            value={user.fitnessProfile?.heightCm}
            type="number"
          />
          <Field
            label="Target Calories"
            field="fitnessProfile.targetCalories"
            value={user.fitnessProfile?.targetCalories}
            type="number"
          />
          <Field
            label="Target Protein (g)"
            field="fitnessProfile.targetProteinG"
            value={user.fitnessProfile?.targetProteinG}
            type="number"
          />
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
        <h2 className="text-base font-bold text-white mb-5">Preferences</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field
            label="Step Goal"
            field="preferences.stepGoal"
            value={user.preferences?.stepGoal}
            type="number"
          />
          <Field
            label="Water Goal (ml)"
            field="preferences.waterGoalMl"
            value={user.preferences?.waterGoalMl}
            type="number"
          />
          <Field
            label="Timezone"
            field="preferences.timezone"
            value={user.preferences?.timezone}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, type: "delete", isLoading: false })}
        onConfirm={handleModalAction}
        isLoading={modal.isLoading}
        {...modalConfig[modal.type]}
      />
    </div>
  );
}

export default AdminUserDetailClient;
