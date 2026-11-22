"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import versionData from "@/version.json";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AppearanceSetting } from "@/components/settings/AppearanceSetting";
import { useUser, type ClientUser } from "@/context/UserContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { useTheme } from "@/hooks/useTheme";
import { api, errorMessage } from "@/lib/client/api";
import { logout } from "@/lib/client/logout";
import { automaticTargets } from "@/lib/fitness/targets";
import { cmToInches, fromKg, inchesToCm, normalizeWeightUnit, toKg, type WeightUnit } from "@/lib/fitness/units";
import { profileLimitProblem, type ProfileLimitKey } from "@/lib/users/limits";
import { THEME_OPTIONS } from "@/lib/ui/theme";
import {
  detectDeviceTimeZone,
  formatDateString,
  isValidDateString,
  localDateString,
  normalizeWeekStart,
  resolveTimeZone,
  type WeekdayKey,
} from "@/lib/time";
import { updateProfileSettingsAction, type SettingsPayload } from "@/lib/users/actions";
import { ANDROID_RELEASES_URL, getNativeAppVersion, openExternalLink, saveFile, triggerAppUpdateCheck } from "@/services/webview-bridge";
import { cn } from "@/lib/utils";
import type { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";

interface FormState {
  name: string;
  sex: Sex | null;
  birthDate: string;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  goal: FitnessGoal | null;
  calorieAdjustment: number | null;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetFiberG: number | null;
  stepGoal: number | null;
  waterGoalMl: number | null;
  restTimerDefaultSec: number;
  weightUnit: WeightUnit;
  timezone: string;
  weekStartDay: WeekdayKey;
}

type SheetKey = "about" | "goal" | "targets" | "daily" | "appearance" | "units" | "timezone" | "week" | "rest" | "ai" | "name";
type Errors = Partial<Record<keyof FormState | "key", string>>;

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Mostly sitting (desk job, little exercise)" },
  { value: "light", label: "Lightly active (exercise 1 to 3 days a week)" },
  { value: "moderate", label: "Moderately active (exercise 3 to 5 days a week)" },
  { value: "active", label: "Very active (hard exercise 6 to 7 days a week)" },
  { value: "very_active", label: "Extremely active (physical job or two sessions a day)" },
];
const GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string }> = [
  { value: "cut", label: "Lose fat" },
  { value: "maintain", label: "Maintain" },
  { value: "bulk", label: "Build muscle" },
];
const WEEK_START_OPTIONS: Array<{ value: WeekdayKey; label: string }> = [
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];
const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function toDateInput(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function fromUser(user: ClientUser | null): FormState {
  const profile = user?.fitnessProfile;
  const preferences = user?.preferences;
  return {
    name: user?.name || "",
    sex: profile?.sex ?? null,
    birthDate: toDateInput(profile?.birthDate),
    age: profile?.age ?? null,
    weightKg: profile?.weightKg ?? null,
    heightCm: profile?.heightCm ?? null,
    activityLevel: profile?.activityLevel ?? null,
    goal: profile?.goal ?? null,
    calorieAdjustment: profile?.calorieAdjustment ?? null,
    targetCalories: profile?.targetCalories ?? null,
    targetProteinG: profile?.targetProteinG ?? null,
    targetCarbsG: profile?.targetCarbsG ?? null,
    targetFatG: profile?.targetFatG ?? null,
    targetFiberG: profile?.targetFiberG ?? null,
    stepGoal: preferences?.stepGoal ?? null,
    waterGoalMl: preferences?.waterGoalMl ?? null,
    restTimerDefaultSec: preferences?.restTimerDefaultSec ?? 90,
    weightUnit: normalizeWeightUnit(preferences?.weightUnit),
    timezone: resolveTimeZone(preferences?.timezone),
    weekStartDay: normalizeWeekStart(preferences?.weekStartDay),
  };
}

function autoFor(form: FormState) {
  return automaticTargets({
    sex: form.sex,
    birthDate: form.birthDate || null,
    age: form.age,
    weightKg: form.weightKg,
    heightCm: form.heightCm,
    activityLevel: form.activityLevel,
    goal: form.goal,
    calorieAdjustment: form.calorieAdjustment,
  });
}

function listTimeZones(current: string, device: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") || [];
  } catch {
    zones = [];
  }
  return Array.from(new Set([current, device, "UTC", ...zones])).sort((a, b) => a.localeCompare(b));
}

function restLabel(seconds: number): string {
  if (seconds === 0) return "Off";
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`;
}

function ageFrom(form: FormState, today: string): number | null {
  if (form.birthDate && isValidDateString(form.birthDate)) {
    const [by, bm, bd] = form.birthDate.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  }
  return form.age;
}

const FOOTER_LINK =
  "inline-flex min-h-8 items-center rounded-control px-2 text-xs text-ink-2 underline-offset-2 transition-colors hover:text-ink hover:underline cursor-pointer";

/** One row of a settings group: a label, the current value and a chevron (rows that open a sheet). */
function SettingRow({
  label,
  value,
  onClick,
  href,
  tone = "ink",
  trailing = "chevron",
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "ink" | "danger";
  trailing?: "chevron" | "download" | "none";
}) {
  const TrailingIcon = trailing === "download" ? Download : trailing === "chevron" ? ChevronRight : null;
  const content = (
    <>
      <span className={cn("shrink-0 text-sm font-medium", tone === "danger" ? "text-danger" : "text-ink")}>{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {value !== undefined && <span className="truncate text-end text-[13px] text-ink-3">{value}</span>}
        {(onClick || href) && TrailingIcon && <TrailingIcon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />}
      </span>
    </>
  );
  const className = "flex min-h-12 w-full items-center justify-between gap-4 px-3.5 py-2.5 text-start";
  const interactive = "transition-colors hover:bg-elevated/60 active:bg-elevated cursor-pointer";
  if (href) {
    return (
      <li>
        <Link href={href} className={cn(className, interactive)}>
          {content}
        </Link>
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} aria-haspopup={trailing === "chevron" ? "dialog" : undefined} className={cn(className, interactive)}>
          {content}
        </button>
      </li>
    );
  }
  return <li className={className}>{content}</li>;
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <SectionHeader id={id} title={title} />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</ul>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[13px] font-medium text-ink-2">{children}</p>;
}

/**
 * Settings: three groups of rows (Body and targets · Preferences · Account
 * and data). Each row opens its own sheet; Save checks the fields there and
 * saves just those values.
 */
export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, refreshUser } = useUser();
  const { preference } = useTheme();
  const isNative = useIsNativeApp();

  const current = useMemo(() => fromUser(user), [user]);
  const [open, setOpen] = useState<SheetKey | null>(null);
  const [shown, setShown] = useState<SheetKey | null>(null);
  const [draft, setDraft] = useState<FormState>(current);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [newKey, setNewKey] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isSignOutAllOpen, setIsSignOutAllOpen] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [signOutAllError, setSignOutAllError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const deviceZone = useMemo(() => detectDeviceTimeZone(), []);
  const timeZones = useMemo(() => listTimeZones(draft.timezone, deviceZone), [draft.timezone, deviceZone]);
  const today = localDateString(new Date(), current.timezone);
  const nativeVersion = isNative ? getNativeAppVersion() : null;
  const autoNow = autoFor(current);
  const autoDraft = autoFor(draft);
  const unit = current.weightUnit;
  const hasCustomKey = Boolean(user?.preferences?.hasCustomGeminiKey);

  const openSheet = (key: SheetKey) => {
    setDraft(fromUser(user));
    setErrors({});
    setFormError(null);
    setNewKey("");
    setShown(key);
    setOpen(key);
  };
  const close = () => {
    if (!saving) setOpen(null);
  };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError(null);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /** Checks the fields of one sheet; returns false when something is wrong. */
  const validate = (key: SheetKey): boolean => {
    const next: Errors = {};
    const limit = (field: keyof FormState, limitKey: ProfileLimitKey) => {
      const problem = profileLimitProblem(limitKey, draft[field] as number | null, unit);
      if (problem) next[field] = problem;
    };
    if (key === "about") {
      if (draft.birthDate && (!isValidDateString(draft.birthDate) || draft.birthDate >= today)) next.birthDate = "Check your date of birth.";
      if (!draft.birthDate) limit("age", "age");
      limit("weightKg", "weightKg");
      limit("heightCm", "heightCm");
    }
    if (key === "goal" && draft.goal !== "maintain") limit("calorieAdjustment", "calorieAdjustment");
    if (key === "targets") {
      limit("targetCalories", "targetCalories");
      limit("targetProteinG", "targetProteinG");
      limit("targetCarbsG", "targetCarbsG");
      limit("targetFatG", "targetFatG");
      limit("targetFiberG", "targetFiberG");
    }
    if (key === "daily") {
      limit("stepGoal", "stepGoal");
      limit("waterGoalMl", "waterGoalMl");
    }
    if (key === "name" && !draft.name.trim()) next.name = "Enter your name.";
    if (key === "ai" && newKey.trim() && !/^[A-Za-z0-9_-]{10,200}$/.test(newKey.trim())) {
      next.key = "That does not look like a Gemini API key. Paste the whole key.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const payloadFor = (key: SheetKey, options: { removeKey?: boolean } = {}): SettingsPayload => {
    const base: SettingsPayload = { name: key === "name" ? draft.name.trim() : current.name || draft.name.trim() || "You", fitnessProfile: {} };
    switch (key) {
      case "about":
        return {
          ...base,
          fitnessProfile: {
            ...(draft.sex ? { sex: draft.sex } : {}),
            birthDate: draft.birthDate || null,
            // The age is only used when there is no date of birth.
            ...(draft.birthDate ? {} : { age: draft.age }),
            weightKg: draft.weightKg,
            heightCm: draft.heightCm,
            ...(draft.activityLevel ? { activityLevel: draft.activityLevel } : {}),
          },
        };
      case "goal":
        return {
          ...base,
          fitnessProfile: {
            ...(draft.goal ? { goal: draft.goal } : {}),
            calorieAdjustment: draft.goal === "maintain" ? null : draft.calorieAdjustment,
          },
        };
      case "targets":
        return {
          ...base,
          fitnessProfile: {
            targetCalories: draft.targetCalories,
            targetProteinG: draft.targetProteinG,
            targetCarbsG: draft.targetCarbsG,
            targetFatG: draft.targetFatG,
            targetFiberG: draft.targetFiberG,
          },
        };
      case "daily":
        return { ...base, preferences: { stepGoal: draft.stepGoal, waterGoalMl: draft.waterGoalMl } };
      case "units":
        return { ...base, preferences: { weightUnit: draft.weightUnit } };
      case "timezone":
        return { ...base, preferences: { timezone: draft.timezone } };
      case "week":
        return { ...base, preferences: { weekStartDay: draft.weekStartDay } };
      case "rest":
        return { ...base, preferences: { restTimerDefaultSec: draft.restTimerDefaultSec } };
      case "ai":
        return options.removeKey ? { ...base, removeCustomGeminiApiKey: true } : { ...base, customGeminiApiKey: newKey.trim() };
      default:
        return base;
    }
  };

  const save = async (key: SheetKey, options: { removeKey?: boolean } = {}) => {
    if (saving) return;
    if (!options.removeKey && !validate(key)) {
      // Move to the first field with a problem once the messages are shown.
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const result = await updateProfileSettingsAction(payloadFor(key, options));
      if (!result.success) {
        setFormError(result.error || "Your settings could not be saved. Please try again.");
        return;
      }
      await refreshUser();
      router.refresh();
      setOpen(null);
      toast(options.removeKey ? "Your key was removed" : "Saved", "success");
    } catch {
      setFormError("Your settings could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/user/export", { credentials: "same-origin" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error || (response.status === 429 ? "You have exported several times recently. Try again in an hour." : "The export could not be created.")
        );
      }
      const blob = await response.blob();
      const saved = await saveFile(blob, `fit-tracker-export-${localDateString(new Date(), current.timezone)}.json`);
      if (saved) toast("Your data was exported", "success");
      else toast("The export could not be saved on this device.", "error");
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : "The export could not be created.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const signOutEverywhere = async () => {
    setIsSigningOutAll(true);
    setSignOutAllError(null);
    try {
      await api("/api/profile", { method: "PATCH", body: { invalidateAllSessions: true } });
      setIsSignOutAllOpen(false);
      toast("Signed out on every other device. This one stays signed in.", "success");
    } catch (err) {
      setSignOutAllError(errorMessage(err));
    } finally {
      setIsSigningOutAll(false);
    }
  };

  // ----- Row summaries -----
  const weightText = (kg: number | null) => (kg == null ? null : `${fromKg(kg, unit, 1)} ${unit}`);
  const heightText = (cm: number | null) => {
    if (cm == null) return null;
    if (unit === "kg") return `${Math.round(cm)} cm`;
    const totalInches = Math.round(cmToInches(cm, 1));
    return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
  };
  const age = ageFrom(current, today);
  const aboutSummary =
    [current.sex === "male" ? "Male" : current.sex === "female" ? "Female" : null, age != null ? `${age}` : null, weightText(current.weightKg), heightText(current.heightCm)]
      .filter(Boolean)
      .join(" · ") || "Not set";
  const goalSummary = current.goal
    ? `${GOAL_OPTIONS.find((option) => option.value === current.goal)?.label}${
        current.goal !== "maintain" && current.calorieAdjustment ? ` · ${current.goal === "cut" ? "−" : "+"}${current.calorieAdjustment} kcal` : ""
      }`
    : "Not set";
  const effectiveCalories = current.targetCalories ?? autoNow.calories;
  const effectiveProtein = current.targetProteinG ?? autoNow.protein;
  const targetsSummary =
    effectiveCalories != null
      ? `${effectiveCalories.toLocaleString("en-US")} kcal${effectiveProtein != null ? ` · ${effectiveProtein} g protein` : ""}`
      : "Add weight and height";
  const dailySummary =
    [current.stepGoal != null ? `${current.stepGoal.toLocaleString("en-US")} steps` : null, current.waterGoalMl != null ? `${current.waterGoalMl / 1000} L` : null]
      .filter(Boolean)
      .join(" · ") || "No goals";

  // ----- Sheets -----
  const heightInches = draft.heightCm == null ? null : cmToInches(draft.heightCm, 1);
  const feet = heightInches == null ? null : Math.floor(heightInches / 12);
  const inches = heightInches == null || feet == null ? null : Math.round((heightInches - feet * 12) * 10) / 10;

  const targetField = (key: "targetCalories" | "targetProteinG" | "targetCarbsG" | "targetFatG" | "targetFiberG", label: string, suffix: string, automatic: number | null) => (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <NumberField
        label={`${label} target in ${suffix}`}
        value={draft[key]}
        onChange={(value) => set(key, value)}
        suffix={suffix}
        placeholder={automatic != null ? String(automatic) : "–"}
        errorMessage={errors[key]}
      />
      {!errors[key] && (
        <p className="mt-1.5 text-xs text-ink-3">
          {draft[key] != null
            ? automatic != null
              ? `Your own value. Automatic: ${automatic.toLocaleString("en-US")} ${suffix}.`
              : "Your own value."
            : automatic != null
              ? "Automatic."
              : "Add your weight and height to calculate it."}
        </p>
      )}
    </div>
  );

  const sheetTitle: Record<SheetKey, string> = {
    about: "About you",
    goal: "Goal",
    targets: "Daily targets",
    daily: "Steps and water",
    appearance: "Appearance",
    units: "Units",
    timezone: "Time zone",
    week: "Week starts on",
    rest: "Rest timer",
    ai: "AI features",
    name: "Name",
  };

  const sheetBody = (key: SheetKey | null): React.ReactNode => {
    switch (key) {
      case "about":
        return (
          <div className="space-y-4">
            <div>
              <FieldLabel>Sex</FieldLabel>
              <SegmentedControl
                label="Sex"
                value={draft.sex ?? ("" as Sex)}
                onChange={(value) => set("sex", value)}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id="settings-birth-date"
                label="Date of birth"
                type="date"
                value={draft.birthDate}
                max={today}
                autoComplete="bday"
                onChange={(event) => set("birthDate", event.target.value)}
                isInvalid={Boolean(errors.birthDate)}
                errorMessage={errors.birthDate}
                inputClassName="font-mono tabular-nums"
              />
              {!draft.birthDate && (
                <div>
                  <FieldLabel>Age</FieldLabel>
                  <NumberField label="Age in years" value={draft.age} onChange={(value) => set("age", value)} suffix="years" errorMessage={errors.age} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Weight</FieldLabel>
                <NumberField
                  label={`Weight in ${unit}`}
                  value={draft.weightKg == null ? null : fromKg(draft.weightKg, unit, 1)}
                  onChange={(value) => set("weightKg", value == null ? null : toKg(value, unit))}
                  decimals={1}
                 
                  suffix={unit}
                  errorMessage={errors.weightKg}
                />
              </div>
              <div>
                <FieldLabel>Height</FieldLabel>
                {unit === "kg" ? (
                  <NumberField label="Height in centimetres" value={draft.heightCm} onChange={(value) => set("heightCm", value)} decimals={1} suffix="cm" errorMessage={errors.heightCm} />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="Height, feet"
                        value={feet}
                        onChange={(value) => set("heightCm", value == null ? null : inchesToCm(value * 12 + (inches || 0), 1))}
                        max={8}
                        suffix="ft"
                        isInvalid={Boolean(errors.heightCm)}
                        describedBy={errors.heightCm ? "settings-height-error" : undefined}
                      />
                      <NumberField
                        label="Height, inches"
                        value={inches}
                        onChange={(value) => set("heightCm", inchesToCm((feet || 0) * 12 + (value || 0), 1))}
                        decimals={1}
                        max={11.9}
                        suffix="in"
                        isInvalid={Boolean(errors.heightCm)}
                        describedBy={errors.heightCm ? "settings-height-error" : undefined}
                      />
                    </div>
                    {errors.heightCm && (
                      <p id="settings-height-error" className="mt-1.5 text-xs text-danger">
                        {errors.heightCm}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <Select<ActivityLevel>
              id="settings-activity"
              label="Activity level"
              value={draft.activityLevel}
              onChange={(value) => set("activityLevel", value)}
              options={ACTIVITY_OPTIONS}
              placeholder="Choose…"
            />
            <p className="text-xs text-ink-3">Used to estimate how many calories you burn.</p>
          </div>
        );
      case "goal":
        return (
          <div className="space-y-4">
            <SegmentedControl label="Goal" value={draft.goal ?? ("" as FitnessGoal)} onChange={(value) => set("goal", value)} options={GOAL_OPTIONS} className="w-full" />
            {draft.goal && draft.goal !== "maintain" && (
              <div>
                <FieldLabel>{draft.goal === "cut" ? "Calories below what you burn" : "Calories above what you burn"}</FieldLabel>
                <NumberField
                  label="Daily calorie change for your goal"
                  value={draft.calorieAdjustment}
                  onChange={(value) => set("calorieAdjustment", value)}
                 
                  suffix="kcal"
                  placeholder={draft.goal === "cut" ? "500" : "300"}
                  errorMessage={errors.calorieAdjustment}
                />
                {!errors.calorieAdjustment && <p className="mt-1.5 text-xs text-ink-3">Leave empty for the standard amount.</p>}
              </div>
            )}
          </div>
        );
      case "targets":
        return (
          <div className="space-y-4">
            <p className="text-[13px] leading-5 text-ink-2">
              {autoDraft.tdee != null
                ? `You burn about ${autoDraft.tdee.toLocaleString("en-US")} kcal a day. Leave a field empty to use the automatic value.`
                : "Leave a field empty to use the automatic value."}
            </p>
            {targetField("targetCalories", "Calories", "kcal", autoDraft.calories)}
            <div className="grid grid-cols-2 gap-3">
              {targetField("targetProteinG", "Protein", "g", autoDraft.protein)}
              {targetField("targetCarbsG", "Carbs", "g", autoDraft.carbs)}
              {targetField("targetFatG", "Fat", "g", autoDraft.fat)}
              {targetField("targetFiberG", "Fibre", "g", autoDraft.fiber)}
            </div>
            {(draft.targetCalories != null || draft.targetProteinG != null || draft.targetCarbsG != null || draft.targetFatG != null || draft.targetFiberG != null) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setErrors({});
                  setDraft((prev) => ({ ...prev, targetCalories: null, targetProteinG: null, targetCarbsG: null, targetFatG: null, targetFiberG: null }));
                }}
              >
                Use automatic values for all
              </Button>
            )}
          </div>
        );
      case "daily":
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Steps per day</FieldLabel>
              <NumberField label="Steps per day" value={draft.stepGoal} onChange={(value) => set("stepGoal", value)} suffix="steps" placeholder="No goal" errorMessage={errors.stepGoal} />
            </div>
            <div>
              <FieldLabel>Water per day</FieldLabel>
              <NumberField
                label="Water per day in millilitres"
                value={draft.waterGoalMl}
                onChange={(value) => set("waterGoalMl", value)}
               
                suffix="ml"
                placeholder="No goal"
                errorMessage={errors.waterGoalMl}
              />
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-2">
            <AppearanceSetting />
            <p className="text-xs text-ink-3">Applies at once, on this device. System follows your phone or computer.</p>
          </div>
        );
      case "units":
        return (
          <div className="space-y-2">
            <SegmentedControl
              label="Weight unit"
              value={draft.weightUnit}
              onChange={(value) => set("weightUnit", value)}
              options={[
                { value: "kg", label: "Kilograms (kg)" },
                { value: "lbs", label: "Pounds (lbs)" },
              ]}
              className="w-full"
            />
            <p className="text-xs text-ink-3">Changes how weights are shown. Nothing you logged is altered.</p>
          </div>
        );
      case "timezone":
        return (
          <div className="space-y-3">
            <Select<string>
              id="settings-timezone"
              label="Time zone"
              value={draft.timezone}
              onChange={(value) => set("timezone", value)}
              options={timeZones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") }))}
              searchable
            />
            <p className="text-xs text-ink-3">Decides when your day starts and ends.</p>
            {draft.timezone !== deviceZone && (
              <Button variant="secondary" size="sm" onClick={() => set("timezone", deviceZone)}>
                Use this device&apos;s zone ({deviceZone.replace(/_/g, " ")})
              </Button>
            )}
          </div>
        );
      case "week":
        return (
          <SegmentedControl label="Week starts on" value={draft.weekStartDay} onChange={(value) => set("weekStartDay", value)} options={WEEK_START_OPTIONS} className="w-full" />
        );
      case "rest":
        return (
          <Select<number>
            id="settings-rest"
            label="Rest timer after a set"
            value={draft.restTimerDefaultSec}
            onChange={(value) => set("restTimerDefaultSec", value)}
            options={Array.from(new Set([...REST_OPTIONS, draft.restTimerDefaultSec]))
              .sort((a, b) => a - b)
              .map((seconds) => ({ value: seconds, label: restLabel(seconds) }))}
          />
        );
      case "ai":
        return (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-ink-2">
              The Coach, meal scans and Plan my day use Google Gemini. With your own key they do not count against the shared daily limit.
            </p>
            <p className="text-sm text-ink">{hasCustomKey ? "Your own key is saved and in use." : "Using the shared key, with a daily limit."}</p>
            <Input
              id="settings-gemini-key"
              label={hasCustomKey ? "Replace your key" : "Your Gemini API key (optional)"}
              description="Stored encrypted; never shown again or sent back to your browser."
              type="password"
              value={newKey}
              onChange={(event) => {
                setErrors((prev) => ({ ...prev, key: undefined }));
                setNewKey(event.target.value.slice(0, 200));
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasCustomKey ? "Paste a new key to replace it" : "Paste your key"}
              isInvalid={Boolean(errors.key)}
              errorMessage={errors.key}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" endContent={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openExternalLink("https://aistudio.google.com/app/apikey")}>
                Get a free key
              </Button>
              {hasCustomKey && (
                <Button variant="ghost" size="sm" className="text-danger hover:text-danger" disabled={saving} onClick={() => void save("ai", { removeKey: true })}>
                  Remove my key
                </Button>
              )}
            </div>
          </div>
        );
      case "name":
        return (
          <Input
            id="settings-name"
            label="Name"
            value={draft.name}
            onChange={(event) => set("name", event.target.value.slice(0, 80))}
            autoComplete="name"
            data-autofocus
            isInvalid={Boolean(errors.name)}
            errorMessage={errors.name}
          />
        );
      default:
        return null;
    }
  };

  // Appearance applies at once: its sheet only has Done.
  const instant = shown === "appearance";
  const aiNeedsKey = shown === "ai" && !newKey.trim();

  return (
    <div className="mx-auto max-w-[680px] space-y-5">
      <SettingGroup title="Body and targets">
        <SettingRow label="About you" value={aboutSummary} onClick={() => openSheet("about")} />
        <SettingRow label="Goal" value={goalSummary} onClick={() => openSheet("goal")} />
        <SettingRow label="Daily targets" value={targetsSummary} onClick={() => openSheet("targets")} />
        <SettingRow label="Steps and water" value={dailySummary} onClick={() => openSheet("daily")} />
      </SettingGroup>

      <SettingGroup title="Preferences">
        <SettingRow label="Appearance" value={THEME_OPTIONS.find((option) => option.value === preference)?.label} onClick={() => openSheet("appearance")} />
        <SettingRow label="Units" value={unit === "kg" ? "Kilograms" : "Pounds"} onClick={() => openSheet("units")} />
        <SettingRow label="Time zone" value={current.timezone.replace(/_/g, " ")} onClick={() => openSheet("timezone")} />
        <SettingRow label="Week starts on" value={WEEK_START_OPTIONS.find((option) => option.value === current.weekStartDay)?.label} onClick={() => openSheet("week")} />
        <SettingRow label="Rest timer" value={restLabel(current.restTimerDefaultSec)} onClick={() => openSheet("rest")} />
        <SettingRow label="AI features" value={hasCustomKey ? "Your own key" : "Shared key"} onClick={() => openSheet("ai")} />
      </SettingGroup>

      <SettingGroup title="Account and data">
        <SettingRow label="Name" value={current.name || "Not set"} onClick={() => openSheet("name")} />
        <SettingRow label="Email" value={user?.email} />
        <SettingRow label="Export my data" value={isExporting ? "Preparing…" : "JSON file"} onClick={() => void exportData()} trailing="download" />
        {user?.role === "admin" && <SettingRow label="Admin panel" href="/admin/dashboard" />}
        <SettingRow
          label="Sign out everywhere else"
          onClick={() => {
            setSignOutAllError(null);
            setIsSignOutAllOpen(true);
          }}
        />
        <SettingRow
          label={isSigningOut ? "Signing out…" : "Sign out"}
          tone="danger"
          onClick={() => {
            if (isSigningOut) return;
            setIsSigningOut(true);
            void logout();
          }}
          trailing="none"
        />
      </SettingGroup>

      <footer className="space-y-1 px-0.5 text-xs text-ink-3">
        <p>
          FitTracker <span className="font-mono tabular-nums">{versionData.versionName}</span>
          {nativeVersion && (
            <>
              {" · Android app "}
              <span className="font-mono tabular-nums">
                {nativeVersion.versionName} ({nativeVersion.versionCode})
              </span>
            </>
          )}
          {user?.createdAt && ` · Member since ${formatDateString(toDateInput(user.createdAt), { month: "long", year: "numeric" })}`}
        </p>
        <div className="-ms-2 flex flex-wrap">
          {isNative ? (
            <>
              <button type="button" onClick={() => triggerAppUpdateCheck()} className={FOOTER_LINK}>
                Check for updates
              </button>
              <Link href="/widgets" className={FOOTER_LINK}>
                Home screen widgets
              </Link>
            </>
          ) : (
            <button type="button" onClick={() => openExternalLink(ANDROID_RELEASES_URL)} className={FOOTER_LINK}>
              Get the Android app
            </button>
          )}
        </div>
      </footer>

      <Sheet
        isOpen={open !== null}
        onClose={close}
        title={shown ? sheetTitle[shown] : "Settings"}
        closeOnBackdropClick={!saving}
        footer={
          instant ? (
            <Button fullWidth onClick={close}>
              Done
            </Button>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="secondary" onClick={close} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="settings-sheet-form" isLoading={saving} disabled={aiNeedsKey}>
                Save
              </Button>
            </div>
          )
        }
      >
        <form
          ref={formRef}
          id="settings-sheet-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (shown && !instant) void save(shown);
          }}
          className="space-y-3"
        >
          {formError && (
            <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
              {formError}
            </p>
          )}
          {sheetBody(shown)}
        </form>
      </Sheet>

      <ConfirmDialog
        isOpen={isSignOutAllOpen}
        onCancel={() => setIsSignOutAllOpen(false)}
        onConfirm={signOutEverywhere}
        title="Sign out everywhere else?"
        message="Every other phone, tablet and browser signed in to your account is signed out. This device stays signed in."
        confirmLabel="Sign out the others"
        isWorking={isSigningOutAll}
        error={signOutAllError}
      />
    </div>
  );
}

export default SettingsClient;
