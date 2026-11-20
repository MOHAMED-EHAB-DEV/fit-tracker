"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import versionData from "@/version.json";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { useUser, type ClientUser } from "@/context/UserContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { api, errorMessage } from "@/lib/client/api";
import { logout } from "@/lib/client/logout";
import { automaticTargets } from "@/lib/fitness/targets";
import { cmToInches, fromKg, inchesToCm, normalizeWeightUnit, toKg, type WeightUnit } from "@/lib/fitness/units";
import {
  detectDeviceTimeZone,
  isValidDateString,
  localDateString,
  normalizeWeekStart,
  resolveTimeZone,
  type WeekdayKey,
} from "@/lib/time";
import { updateProfileSettingsAction, type SettingsPayload } from "@/lib/users/actions";
import {
  ANDROID_RELEASES_URL,
  getNativeAppVersion,
  openExternalLink,
  saveFile,
  triggerAppUpdateCheck,
} from "@/services/webview-bridge";
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

const LABEL_CLASS = "block text-sm font-medium text-zinc-200";
const HELP_CLASS = "text-sm text-zinc-400";

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

function listTimeZones(current: string, device: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") || [];
  } catch {
    zones = [];
  }
  return Array.from(new Set([current, device, "UTC", ...zones])).sort((a, b) => a.localeCompare(b));
}

/** The first problem that would make the server reject the form, in plain words. */
function findProblem(form: FormState, today: string): string | null {
  if (!form.name.trim()) return "Enter your name.";
  if (form.birthDate && (!isValidDateString(form.birthDate) || form.birthDate >= today)) {
    return "Check your date of birth.";
  }
  // Same range as the server (and as body check-ins, which can set this weight).
  if (form.weightKg != null && (form.weightKg < 20 || form.weightKg > 400)) {
    return form.weightUnit === "lbs" ? "Weight must be between 44 and 881 lbs." : "Weight must be between 20 and 400 kg.";
  }
  if (form.heightCm != null && (form.heightCm < 100 || form.heightCm > 250)) {
    return form.weightUnit === "lbs"
      ? "Height must be between 3 ft 4 in and 8 ft 2 in."
      : "Height must be between 100 and 250 cm.";
  }
  if (form.age != null && !form.birthDate && (form.age < 10 || form.age > 100)) return "Age must be between 10 and 100.";
  if (form.targetCalories != null && (form.targetCalories < 800 || form.targetCalories > 10_000)) {
    return "The calorie target must be between 800 and 10,000 kcal.";
  }
  if (form.targetProteinG != null && form.targetProteinG > 600) return "The protein target must be at most 600 g.";
  if (form.targetCarbsG != null && form.targetCarbsG > 1500) return "The carbs target must be at most 1,500 g.";
  if (form.targetFatG != null && form.targetFatG > 500) return "The fat target must be at most 500 g.";
  if (form.targetFiberG != null && form.targetFiberG > 150) return "The fibre target must be at most 150 g.";
  if (form.calorieAdjustment != null && form.calorieAdjustment > 1500) {
    return "The daily calorie change must be at most 1,500 kcal.";
  }
  if (form.stepGoal != null && (form.stepGoal < 500 || form.stepGoal > 100_000)) {
    return "The step goal must be between 500 and 100,000.";
  }
  if (form.waterGoalMl != null && (form.waterGoalMl < 250 || form.waterGoalMl > 10_000)) {
    return "The water goal must be between 250 and 10,000 ml.";
  }
  return null;
}

export function SettingsClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, refreshUser } = useUser();
  const isNative = useIsNativeApp();

  const [baseline, setBaseline] = useState<FormState>(() => fromUser(user));
  const [form, setForm] = useState<FormState>(baseline);
  const [newKey, setNewKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSignOutAllOpen, setIsSignOutAllOpen] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [signOutAllError, setSignOutAllError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const hasSavedKey = Boolean(user?.preferences?.hasCustomGeminiKey) && !removeKey;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline) || newKey.trim().length > 0 || removeKey;
  useUnsavedChanges(isDirty && !isSaving);

  const deviceZone = useMemo(() => detectDeviceTimeZone(), []);
  const timeZones = useMemo(() => listTimeZones(form.timezone, deviceZone), [form.timezone, deviceZone]);
  const today = localDateString(new Date(), form.timezone);
  const nativeVersion = isNative ? getNativeAppVersion() : null;

  const auto = useMemo(
    () =>
      automaticTargets({
        sex: form.sex,
        birthDate: form.birthDate || null,
        age: form.age,
        weightKg: form.weightKg,
        heightCm: form.heightCm,
        activityLevel: form.activityLevel,
        goal: form.goal,
        calorieAdjustment: form.calorieAdjustment,
      }),
    [form.sex, form.birthDate, form.age, form.weightKg, form.heightCm, form.activityLevel, form.goal, form.calorieAdjustment]
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setError(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const heightInches = form.heightCm == null ? null : cmToInches(form.heightCm, 1);
  const feet = heightInches == null ? null : Math.floor(heightInches / 12);
  const inches = heightInches == null || feet == null ? null : Math.round((heightInches - feet * 12) * 10) / 10;

  const hasCustomTargets =
    form.targetCalories != null ||
    form.targetProteinG != null ||
    form.targetCarbsG != null ||
    form.targetFatG != null ||
    form.targetFiberG != null;

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isSaving) return;
    const problem = findProblem(form, today);
    if (problem) {
      setError(problem);
      return;
    }
    const key = newKey.trim();
    if (key && key.length < 10) {
      setError("That API key looks too short. Paste the whole key.");
      return;
    }

    setIsSaving(true);
    setError(null);
    const payload: SettingsPayload = {
      name: form.name.trim(),
      fitnessProfile: {
        ...(form.sex ? { sex: form.sex } : {}),
        birthDate: form.birthDate || null,
        // The age is only used when there is no date of birth.
        ...(form.birthDate ? {} : { age: form.age }),
        weightKg: form.weightKg,
        heightCm: form.heightCm,
        ...(form.activityLevel ? { activityLevel: form.activityLevel } : {}),
        ...(form.goal ? { goal: form.goal } : {}),
        calorieAdjustment: form.goal === "maintain" ? null : form.calorieAdjustment,
        targetCalories: form.targetCalories,
        targetProteinG: form.targetProteinG,
        targetCarbsG: form.targetCarbsG,
        targetFatG: form.targetFatG,
        targetFiberG: form.targetFiberG,
      },
      preferences: {
        stepGoal: form.stepGoal,
        waterGoalMl: form.waterGoalMl,
        restTimerDefaultSec: form.restTimerDefaultSec,
        weightUnit: form.weightUnit,
        timezone: form.timezone,
        weekStartDay: form.weekStartDay,
      },
      ...(key ? { customGeminiApiKey: key } : {}),
      ...(removeKey && !key ? { removeCustomGeminiApiKey: true } : {}),
    };

    try {
      const result = await updateProfileSettingsAction(payload);
      if (!result.success) {
        setError(result.error || "Your settings could not be saved. Please try again.");
        return;
      }
      setBaseline(form);
      setNewKey("");
      setRemoveKey(false);
      await refreshUser();
      router.refresh();
      toast("Settings saved", "success");
    } catch {
      setError("Your settings could not be saved. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const discard = () => {
    setForm(baseline);
    setNewKey("");
    setRemoveKey(false);
    setError(null);
  };

  const exportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/user/export", { credentials: "same-origin" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          body?.error ||
            (response.status === 429
              ? "You have exported several times recently. Try again in an hour."
              : "The export could not be created.")
        );
      }
      const blob = await response.blob();
      const saved = await saveFile(blob, `fit-tracker-export-${localDateString(new Date(), form.timezone)}.json`);
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

  const targetField = (
    key: "targetCalories" | "targetProteinG" | "targetCarbsG" | "targetFatG" | "targetFiberG",
    label: string,
    unit: string,
    automatic: number | null,
    max: number
  ) => (
    <div className="space-y-1.5">
      <p className={LABEL_CLASS}>{label}</p>
      <NumberField
        label={`${label} target in ${unit}`}
        value={form[key]}
        onChange={(value) => set(key, value)}
        max={max}
        suffix={unit}
        placeholder={automatic != null ? String(automatic) : "–"}
      />
      <p className={HELP_CLASS}>
        {form[key] != null
          ? automatic != null
            ? `Your own value. Automatic would be ${automatic.toLocaleString("en-US")} ${unit}.`
            : "Your own value."
          : automatic != null
            ? "Automatic."
            : "Add your weight and height to calculate it."}
      </p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <form onSubmit={save} className="space-y-6" noValidate>
        <Section title="About you" description="Used to estimate how many calories you burn.">
          <Input
            id="settings-name"
            label="Name"
            value={form.name}
            onChange={(event) => set("name", event.target.value.slice(0, 80))}
            autoComplete="name"
          />

          <div className="space-y-1.5">
            <p className={LABEL_CLASS}>Sex</p>
            <SegmentedControl
              label="Sex"
              value={form.sex ?? ("" as Sex)}
              onChange={(value) => set("sex", value)}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="settings-birth-date"
              label="Date of birth"
              type="date"
              value={form.birthDate}
              max={today}
              autoComplete="bday"
              onChange={(event) => set("birthDate", event.target.value)}
            />
            {!form.birthDate && (
              <div className="space-y-1.5">
                <p className={LABEL_CLASS}>Age</p>
                <NumberField
                  label="Age in years"
                  value={form.age}
                  onChange={(value) => set("age", value)}
                  max={100}
                  suffix="years"
                />
                <p className={HELP_CLASS}>Only used until you add a date of birth.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className={LABEL_CLASS}>Weight</p>
              <NumberField
                label={`Weight in ${form.weightUnit}`}
                value={form.weightKg == null ? null : fromKg(form.weightKg, form.weightUnit, 1)}
                onChange={(value) => set("weightKg", value == null ? null : toKg(value, form.weightUnit))}
                decimals={1}
                max={form.weightUnit === "lbs" ? 700 : 320}
                suffix={form.weightUnit}
              />
            </div>
            <div className="space-y-1.5">
              <p className={LABEL_CLASS}>Height</p>
              {form.weightUnit === "kg" ? (
                <NumberField
                  label="Height in centimetres"
                  value={form.heightCm}
                  onChange={(value) => set("heightCm", value)}
                  decimals={1}
                  max={260}
                  suffix="cm"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Height, feet"
                    value={feet}
                    onChange={(value) =>
                      set("heightCm", value == null ? null : inchesToCm(value * 12 + (inches || 0), 1))
                    }
                    max={8}
                    suffix="ft"
                  />
                  <NumberField
                    label="Height, inches"
                    value={inches}
                    onChange={(value) => set("heightCm", inchesToCm((feet || 0) * 12 + (value || 0), 1))}
                    decimals={1}
                    max={11.9}
                    suffix="in"
                  />
                </div>
              )}
            </div>
          </div>

          <Select<ActivityLevel>
            id="settings-activity"
            label="Activity level"
            value={form.activityLevel}
            onChange={(value) => set("activityLevel", value)}
            options={ACTIVITY_OPTIONS}
            placeholder="Choose…"
          />

          <div className="space-y-1.5">
            <p className={LABEL_CLASS}>Goal</p>
            <SegmentedControl
              label="Goal"
              value={form.goal ?? ("" as FitnessGoal)}
              onChange={(value) => set("goal", value)}
              options={GOAL_OPTIONS}
              className="w-full"
            />
          </div>

          {form.goal && form.goal !== "maintain" && (
            <div className="space-y-1.5">
              <p className={LABEL_CLASS}>
                {form.goal === "cut" ? "Calories below what you burn" : "Calories above what you burn"}
              </p>
              <NumberField
                label="Daily calorie change for your goal"
                value={form.calorieAdjustment}
                onChange={(value) => set("calorieAdjustment", value)}
                max={1500}
                suffix="kcal"
                placeholder={form.goal === "cut" ? "500" : "300"}
              />
              <p className={HELP_CLASS}>Leave empty for the standard amount.</p>
            </div>
          )}
        </Section>

        <Section
          title="Daily targets"
          description={
            auto.tdee != null
              ? `You burn about ${auto.tdee.toLocaleString("en-US")} kcal a day (an estimate from the answers above). Leave a field empty to use the automatic value.`
              : "Leave a field empty to use the automatic value."
          }
        >
          {targetField("targetCalories", "Calories", "kcal", auto.calories, 10_000)}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {targetField("targetProteinG", "Protein", "g", auto.protein, 600)}
            {targetField("targetCarbsG", "Carbs", "g", auto.carbs, 1500)}
            {targetField("targetFatG", "Fat", "g", auto.fat, 500)}
            {targetField("targetFiberG", "Fibre", "g", auto.fiber, 150)}
          </div>
          {hasCustomTargets && (
            <Button
              type="button"
              variant="bordered"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  targetCalories: null,
                  targetProteinG: null,
                  targetCarbsG: null,
                  targetFatG: null,
                  targetFiberG: null,
                }))
              }
            >
              Use automatic values for all
            </Button>
          )}
        </Section>

        <Section title="Daily goals">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className={LABEL_CLASS}>Steps per day</p>
              <NumberField
                label="Steps per day"
                value={form.stepGoal}
                onChange={(value) => set("stepGoal", value)}
                max={100_000}
                suffix="steps"
                placeholder="No goal"
              />
            </div>
            <div className="space-y-1.5">
              <p className={LABEL_CLASS}>Water per day</p>
              <NumberField
                label="Water per day in millilitres"
                value={form.waterGoalMl}
                onChange={(value) => set("waterGoalMl", value)}
                max={10_000}
                suffix="ml"
                placeholder="No goal"
              />
            </div>
          </div>
        </Section>

        <Section title="Units and time">
          <div className="space-y-1.5">
            <p className={LABEL_CLASS}>Weight unit</p>
            <SegmentedControl
              label="Weight unit"
              value={form.weightUnit}
              onChange={(value) => set("weightUnit", value)}
              options={[
                { value: "kg", label: "Kilograms (kg)" },
                { value: "lbs", label: "Pounds (lbs)" },
              ]}
              className="w-full"
            />
            <p className={HELP_CLASS}>Changes how weights are shown. Nothing you logged is altered.</p>
          </div>

          <div className="space-y-1.5">
            <Select<string>
              id="settings-timezone"
              label="Time zone"
              value={form.timezone}
              onChange={(value) => set("timezone", value)}
              options={timeZones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") }))}
              searchable
            />
            <p className={HELP_CLASS}>Decides when your day starts and ends.</p>
            {form.timezone !== deviceZone && (
              <Button type="button" variant="bordered" size="sm" onClick={() => set("timezone", deviceZone)}>
                Use this device&apos;s zone ({deviceZone.replace(/_/g, " ")})
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select<WeekdayKey>
              id="settings-week-start"
              label="Week starts on"
              value={form.weekStartDay}
              onChange={(value) => set("weekStartDay", value)}
              options={WEEK_START_OPTIONS}
            />
            <Select<number>
              id="settings-rest"
              label="Rest timer after a set"
              value={form.restTimerDefaultSec}
              onChange={(value) => set("restTimerDefaultSec", value)}
              options={Array.from(new Set([...REST_OPTIONS, form.restTimerDefaultSec]))
                .sort((a, b) => a - b)
                .map((seconds) => ({
                  value: seconds,
                  label:
                    seconds === 0
                      ? "Off"
                      : seconds < 60
                        ? `${seconds} seconds`
                        : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ""}`,
                }))}
            />
          </div>
        </Section>

        <Section
          title="AI features"
          description="The coach, photo meal estimates and the AI day plan use Google Gemini. With your own key they do not count against the shared daily limit."
        >
          <p className="text-base text-zinc-300">
            {hasSavedKey ? "Your own key is saved and in use." : "Using the shared key, with a daily limit."}
          </p>
          <Input
            id="settings-gemini-key"
            label={hasSavedKey ? "Replace your key" : "Your Gemini API key (optional)"}
            description="The key is stored encrypted and is never shown again or sent back to your browser."
            type="password"
            value={newKey}
            onChange={(event) => {
              setError(null);
              setNewKey(event.target.value.slice(0, 200));
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder={hasSavedKey ? "Paste a new key to replace it" : "Paste your key"}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="bordered"
              size="sm"
              endContent={<ExternalLink className="h-4 w-4" />}
              onClick={() => openExternalLink("https://aistudio.google.com/app/apikey")}
            >
              Get a free key
            </Button>
            {user?.preferences?.hasCustomGeminiKey && !removeKey && (
              <Button
                type="button"
                variant="bordered"
                size="sm"
                className="text-red-300 border-red-500/30"
                onClick={() => {
                  setRemoveKey(true);
                  setNewKey("");
                }}
              >
                Remove my key
              </Button>
            )}
          </div>
          {removeKey && (
            <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
              Your key will be removed when you save.{" "}
              <button type="button" onClick={() => setRemoveKey(false)} className="font-semibold underline cursor-pointer">
                Keep it
              </button>
            </p>
          )}
        </Section>

        {isDirty && (
          <div className="fixed inset-x-0 bottom-above-nav z-30 px-3 pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-2xl rounded-2xl border border-line bg-zinc-900 p-3 shadow-xl shadow-black/50">
              {error && (
                <p role="alert" className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 text-sm text-zinc-300">Unsaved changes</p>
                <Button type="button" variant="bordered" onClick={discard} disabled={isSaving}>
                  Discard
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      <Section title="Account">
        <p className="text-base text-zinc-300 break-all">Signed in as {user?.email}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="bordered"
            startContent={<LogOut className="h-4 w-4" />}
            isLoading={isSigningOut}
            onClick={() => {
              setIsSigningOut(true);
              void logout();
            }}
          >
            Sign out
          </Button>
          <Button
            variant="bordered"
            onClick={() => {
              setSignOutAllError(null);
              setIsSignOutAllOpen(true);
            }}
          >
            Sign out everywhere else
          </Button>
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Admin panel
            </Link>
          )}
        </div>
      </Section>

      <Section
        title="Your data"
        description="Download everything you have logged: workouts, routines, records, meals, daily logs, habits, plans and check-ins."
      >
        <div>
          <Button
            variant="bordered"
            startContent={<Download className="h-4 w-4" />}
            isLoading={isExporting}
            onClick={() => void exportData()}
          >
            Export my data (JSON)
          </Button>
        </div>
      </Section>

      <Section title="App">
        <p className="text-base text-zinc-300">
          {nativeVersion
            ? `Android app version ${nativeVersion.versionName} (${nativeVersion.versionCode})`
            : `Web version ${versionData.versionName}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {isNative ? (
            <>
              <Button
                variant="bordered"
                startContent={<RefreshCw className="h-4 w-4" />}
                onClick={() => triggerAppUpdateCheck()}
              >
                Check for updates
              </Button>
              <Link
                href="/widgets"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:bg-white/5"
              >
                Home screen widgets
              </Link>
            </>
          ) : (
            <Button
              variant="bordered"
              endContent={<ExternalLink className="h-4 w-4" />}
              onClick={() => openExternalLink(ANDROID_RELEASES_URL)}
            >
              Get the Android app
            </Button>
          )}
        </div>
      </Section>

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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default SettingsClient;
