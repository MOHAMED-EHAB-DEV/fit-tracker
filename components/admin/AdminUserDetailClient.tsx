"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
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
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FIELD_LABEL } from "@/components/ui/field-styles";
import { useToast } from "@/components/ui/Toast";
import { apiRequest, errorMessage } from "@/components/admin/api";
import { formatAdminDate, formatAdminDateTime, useAdminZone } from "@/components/admin/AdminZone";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { userActionCopy, type UserAction } from "@/components/admin/userActions";
import { SEX_OPTIONS, FITNESS_GOALS, ACTIVITY_LEVELS } from "@/constants/user";
import type { AdminUserDetail, AdminUserStats, UserPermissions } from "@/lib/admin/users";

interface Detail {
  user: AdminUserDetail;
  stats: AdminUserStats;
  permissions: UserPermissions;
}

// ── Editable fields ─────────────────────────────────────────────────────────

type FieldKey =
  | "name"
  | "sex"
  | "goal"
  | "activityLevel"
  | "weightKg"
  | "heightCm"
  | "targetCalories"
  | "targetProteinG"
  | "stepGoal"
  | "waterGoalMl"
  | "timezone";

type FormValues = Record<FieldKey, string>;

interface NumberRule {
  min: number;
  max: number;
  integer: boolean;
}

const NUMBER_RULES: Partial<Record<FieldKey, NumberRule>> = {
  weightKg: { min: 20, max: 400, integer: false },
  heightCm: { min: 90, max: 260, integer: false },
  targetCalories: { min: 800, max: 10_000, integer: true },
  targetProteinG: { min: 0, max: 600, integer: true },
  stepGoal: { min: 500, max: 100_000, integer: true },
  waterGoalMl: { min: 250, max: 10_000, integer: true },
};

function toForm(user: AdminUserDetail): FormValues {
  const text = (value: number | string | null) => (value === null || value === undefined ? "" : String(value));
  return {
    name: user.name,
    sex: text(user.fitnessProfile.sex),
    goal: text(user.fitnessProfile.goal),
    activityLevel: text(user.fitnessProfile.activityLevel),
    weightKg: text(user.fitnessProfile.weightKg),
    heightCm: text(user.fitnessProfile.heightCm),
    targetCalories: text(user.fitnessProfile.targetCalories),
    targetProteinG: text(user.fitnessProfile.targetProteinG),
    stepGoal: text(user.preferences.stepGoal),
    waterGoalMl: text(user.preferences.waterGoalMl),
    timezone: user.preferences.timezone,
  };
}

/** Validates the changed fields and builds the PATCH body (only changed fields). */
function buildPatch(initial: FormValues, values: FormValues) {
  const errors: Partial<Record<FieldKey, string>> = {};
  const fitnessProfile: Record<string, unknown> = {};
  const preferences: Record<string, unknown> = {};
  const patch: Record<string, unknown> = {};

  for (const key of Object.keys(values) as FieldKey[]) {
    const raw = values[key].trim();
    if (raw === initial[key].trim()) continue;

    const rule = NUMBER_RULES[key];
    let value: unknown = raw;
    if (rule) {
      if (raw === "") {
        value = null;
      } else {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < rule.min || parsed > rule.max) {
          errors[key] = `Enter a number from ${rule.min.toLocaleString()} to ${rule.max.toLocaleString()}`;
          continue;
        }
        if (rule.integer && !Number.isInteger(parsed)) {
          errors[key] = "Enter a whole number";
          continue;
        }
        value = parsed;
      }
    }

    if (key === "name") {
      if (!raw) errors.name = "Name cannot be empty";
      else patch.name = raw;
    } else if (key === "sex" || key === "goal" || key === "activityLevel") {
      if (!raw) errors[key] = "Choose a value";
      else fitnessProfile[key] = raw;
    } else if (key === "weightKg" || key === "heightCm" || key === "targetCalories" || key === "targetProteinG") {
      fitnessProfile[key] = value;
    } else if (key === "timezone") {
      if (!raw) errors.timezone = "Enter a time zone such as Africa/Cairo";
      else preferences.timezone = raw;
    } else {
      preferences[key] = value;
    }
  }

  if (Object.keys(fitnessProfile).length) patch.fitnessProfile = fitnessProfile;
  if (Object.keys(preferences).length) patch.preferences = preferences;
  return { patch, errors };
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  options?: { value: string; label: string }[];
  rule?: NumberRule;
  hint?: string;
}

/** One labelled input or select. Defined at module level so typing never remounts it. */
function Field({ label, value, onChange, error, options, rule, hint }: FieldProps) {
  if (options) {
    return (
      <Select<string>
        label={label}
        options={[{ value: "", label: "Not set" }, ...options]}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        error={error}
      />
    );
  }
  return (
    <Input
      label={label}
      type={rule ? "number" : "text"}
      inputMode={rule ? (rule.integer ? "numeric" : "decimal") : undefined}
      min={rule?.min}
      max={rule?.max}
      step={rule ? (rule.integer ? 1 : 0.1) : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      isInvalid={Boolean(error)}
      errorMessage={error}
      description={hint}
    />
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const iconButton =
  "min-h-11 min-w-11 flex items-center justify-center rounded-xl text-zinc-300 transition cursor-pointer focus:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed";

export function AdminUserDetailClient({ initial }: { initial: Detail }) {
  const router = useRouter();
  const { toast } = useToast();
  const timeZone = useAdminZone();

  const [detail, setDetail] = useState(initial);
  const [baseline, setBaseline] = useState(() => toForm(initial.user));
  const [values, setValues] = useState(baseline);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const [modal, setModal] = useState<UserAction | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const actionRef = useRef(false);

  const [resetLink, setResetLink] = useState<{ link: string; expiresAt: string } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { user, stats, permissions } = detail;
  const dirty = (Object.keys(values) as FieldKey[]).some((key) => values[key].trim() !== baseline[key].trim());
  useUnsavedChanges(dirty);

  const setField = (key: FieldKey) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const applyDetail = (next: Detail) => {
    setDetail(next);
    const form = toForm(next.user);
    setBaseline(form);
    setValues(form);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const { patch, errors: found } = buildPatch(baseline, values);
    setErrors(found);
    setSaveError(null);
    if (Object.keys(found).length) {
      setSaveError("Fix the highlighted fields first.");
      return;
    }
    if (Object.keys(patch).length === 0) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const data = await apiRequest<Detail>(`/api/admin/users/${user.id}`, { method: "PATCH", body: patch });
      applyDetail({ user: data.user, stats: data.stats, permissions: data.permissions });
      toast("Profile saved. BMR, TDEE and targets were recalculated.", "success");
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const runAction = async () => {
    if (!modal || actionRef.current) return;
    actionRef.current = true;
    setModalBusy(true);
    setModalError(null);
    try {
      if (modal === "delete") {
        const data = await apiRequest<{ message: string }>(`/api/admin/users/${user.id}`, { method: "DELETE" });
        toast(data.message, data.message.includes("could not") ? "warning" : "success");
        setModal(null);
        router.push("/admin/users");
        router.refresh();
        return;
      }
      const body =
        modal === "ban" || modal === "unban" ? { isBanned: modal === "ban" } : { role: modal === "promote" ? "admin" : "user" };
      const data = await apiRequest<Detail>(`/api/admin/users/${user.id}`, { method: "PATCH", body });
      setDetail({ user: data.user, stats: data.stats, permissions: data.permissions });
      toast(userActionCopy(modal, user.name).done, "success");
      setModal(null);
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      actionRef.current = false;
      setModalBusy(false);
    }
  };

  const createResetLink = async () => {
    if (resetBusy) return;
    setResetBusy(true);
    setCopied(false);
    try {
      const data = await apiRequest<{ link: string; expiresAt: string }>(`/api/admin/users/${user.id}/reset-link`, {
        method: "POST",
      });
      setResetLink({ link: data.link, expiresAt: data.expiresAt });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setResetBusy(false);
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLink.link);
      setCopied(true);
      toast("Reset link copied", "success");
    } catch {
      toast("Copying is blocked in this browser. Select the link and copy it by hand.", "warning");
    }
  };

  const lockReason = permissions.isSelf
    ? "This is your own account"
    : permissions.isLastActiveAdmin
      ? "The last admin who can sign in cannot be demoted, banned or deleted"
      : null;
  const copy = modal ? userActionCopy(modal, user.name) : null;

  const sexOptions = SEX_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
  const goalOptions = FITNESS_GOALS.map((goal) => ({ value: goal.key, label: goal.label }));
  const activityOptions = ACTIVITY_LEVELS.map((level) => ({ value: level.key, label: level.label }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/users"
          className={`${iconButton} hover:text-white hover:bg-zinc-900 focus-visible:ring-violet-400`}
          aria-label="Back to users"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-extrabold text-white break-words">
            {user.name}
            {permissions.isSelf && <span className="ml-2 text-sm font-bold text-violet-300">(you)</span>}
          </h1>
          <p className="text-zinc-400 text-sm font-mono break-all">{user.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={Boolean(lockReason)}
            onClick={() => {
              setModalError(null);
              setModal(user.isBanned ? "unban" : "ban");
            }}
            className={`${iconButton} hover:text-amber-300 hover:bg-amber-500/10 focus-visible:ring-amber-400`}
            title={lockReason || (user.isBanned ? "Unban" : "Ban")}
            aria-label={user.isBanned ? "Unban user" : "Ban user"}
          >
            {user.isBanned ? <CheckCircle className="w-5 h-5" aria-hidden="true" /> : <Ban className="w-5 h-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            disabled={Boolean(lockReason)}
            onClick={() => {
              setModalError(null);
              setModal(user.role === "admin" ? "demote" : "promote");
            }}
            className={`${iconButton} hover:text-violet-300 hover:bg-violet-500/10 focus-visible:ring-violet-400`}
            title={lockReason || (user.role === "admin" ? "Remove admin rights" : "Make admin")}
            aria-label={user.role === "admin" ? "Remove admin rights" : "Make admin"}
          >
            {user.role === "admin" ? <Shield className="w-5 h-5" aria-hidden="true" /> : <ShieldCheck className="w-5 h-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            disabled={Boolean(lockReason)}
            onClick={() => {
              setModalError(null);
              setModal("delete");
            }}
            className={`${iconButton} hover:text-red-300 hover:bg-red-500/10 focus-visible:ring-red-400`}
            title={lockReason || "Delete user"}
            aria-label="Delete user"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {lockReason && (
        <p className="text-sm text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          {permissions.isSelf
            ? "This is your account: you cannot change your own role, ban or delete yourself here. Ask another admin."
            : "This is the only admin who can sign in. Make another user an admin before demoting, banning or deleting this one."}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Completed workouts", value: stats.completedWorkouts.toLocaleString(), icon: Dumbbell, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Meals logged", value: stats.meals.toLocaleString(), icon: UtensilsCrossed, color: "text-pink-400", bg: "bg-pink-500/10" },
          { label: "Body check-ins", value: stats.checkIns.toLocaleString(), icon: Scale, color: "text-teal-400", bg: "bg-teal-500/10" },
          { label: "BMR", value: user.computed.bmr ? `${Math.round(user.computed.bmr)} kcal` : "Not enough data", icon: Activity, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map((card) => (
          <div key={card.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color}`} aria-hidden="true" />
            </div>
            <p className="text-xl font-bold text-white tabular-nums">{card.value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1 rounded-full font-bold uppercase border bg-violet-500/15 text-violet-300 border-violet-500/30">
          {user.role}
        </span>
        {user.isBanned && (
          <span className="px-3 py-1 rounded-full font-bold uppercase bg-red-500/10 text-red-300 border border-red-500/20">Banned</span>
        )}
        <span className="px-3 py-1 rounded-full font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
          {user.isProfileComplete ? "Profile complete" : "Profile incomplete"}
        </span>
        <span className="px-3 py-1 rounded-full text-zinc-300 border border-zinc-800 tabular-nums">
          Joined {formatAdminDate(user.createdAt, timeZone)}
        </span>
        <span className="px-3 py-1 rounded-full text-zinc-300 border border-zinc-800 tabular-nums">
          Last sign-in {formatAdminDateTime(user.lastLoginAt, timeZone)}
        </span>
      </div>

      <section className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6 space-y-3" aria-labelledby="reset-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="reset-heading" className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-violet-400" aria-hidden="true" /> Password reset link
            </h2>
            <p className="text-sm text-zinc-400">
              One-time link, valid for 30 minutes. Creating a new one cancels the previous link. Send it to the user yourself.
            </p>
          </div>
          <Button type="button" variant="bordered" size="md" onClick={createResetLink} isLoading={resetBusy} disabled={user.isBanned} className="min-h-11">
            {resetLink ? "Create a new link" : "Create reset link"}
          </Button>
        </div>
        {resetLink && (
          <div className="space-y-2">
            <label htmlFor="reset-link" className={FIELD_LABEL}>
              Link (shown only now)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="reset-link"
                readOnly
                value={resetLink.link}
                onFocus={(e) => e.currentTarget.select()}
                containerClassName="flex-1"
                inputClassName="font-mono"
              />
              <Button
                type="button"
                variant="solid"
                size="md"
                onClick={copyResetLink}
                startContent={copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                className="min-h-11"
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="text-xs text-zinc-400">Expires {formatAdminDateTime(resetLink.expiresAt, timeZone)}.</p>
          </div>
        )}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="space-y-6"
        noValidate
      >
        <section className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6" aria-labelledby="profile-heading">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-violet-400" aria-hidden="true" />
            <h2 id="profile-heading" className="text-base font-bold text-white">Fitness profile</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Name" value={values.name} onChange={setField("name")} error={errors.name} />
            <Field label="Sex" value={values.sex} onChange={setField("sex")} options={sexOptions} error={errors.sex} />
            <Field label="Goal" value={values.goal} onChange={setField("goal")} options={goalOptions} error={errors.goal} />
            <Field label="Activity level" value={values.activityLevel} onChange={setField("activityLevel")} options={activityOptions} error={errors.activityLevel} />
            <Field label="Weight (kg)" value={values.weightKg} onChange={setField("weightKg")} rule={NUMBER_RULES.weightKg} error={errors.weightKg} />
            <Field label="Height (cm)" value={values.heightCm} onChange={setField("heightCm")} rule={NUMBER_RULES.heightCm} error={errors.heightCm} />
            <Field
              label="Custom calorie target"
              value={values.targetCalories}
              onChange={setField("targetCalories")}
              rule={NUMBER_RULES.targetCalories}
              error={errors.targetCalories}
              hint="Leave empty to calculate it"
            />
            <Field
              label="Custom protein target (g)"
              value={values.targetProteinG}
              onChange={setField("targetProteinG")}
              rule={NUMBER_RULES.targetProteinG}
              error={errors.targetProteinG}
              hint="Leave empty to calculate it"
            />
          </div>
        </section>

        <section className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6" aria-labelledby="prefs-heading">
          <h2 id="prefs-heading" className="text-base font-bold text-white mb-5">Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Daily step goal" value={values.stepGoal} onChange={setField("stepGoal")} rule={NUMBER_RULES.stepGoal} error={errors.stepGoal} />
            <Field label="Daily water goal (ml)" value={values.waterGoalMl} onChange={setField("waterGoalMl")} rule={NUMBER_RULES.waterGoalMl} error={errors.waterGoalMl} />
            <Field label="Time zone" value={values.timezone} onChange={setField("timezone")} error={errors.timezone} hint="IANA name, e.g. Africa/Cairo" />
          </div>
        </section>

        {saveError && (
          <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {saveError}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={!dirty || isSaving}
            onClick={() => {
              setValues(baseline);
              setErrors({});
              setSaveError(null);
            }}
            className="min-h-11"
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={!dirty}
            isLoading={isSaving}
            startContent={<Save className="w-4 h-4" aria-hidden="true" />}
            className="min-h-11"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <ConfirmModal
        isOpen={Boolean(modal)}
        onClose={() => {
          if (!modalBusy) setModal(null);
        }}
        onConfirm={runAction}
        title={copy?.title || ""}
        message={copy?.message || ""}
        confirmLabel={copy?.confirmLabel || "Confirm"}
        confirmVariant={copy?.variant || "danger"}
        isLoading={modalBusy}
        error={modalError}
      />
    </div>
  );
}

export default AdminUserDetailClient;
