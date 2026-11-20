"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { api, errorMessage } from "@/lib/client/api";
import { logout } from "@/lib/client/logout";
import { cn } from "@/lib/utils";
import { dailyTargets } from "@/lib/fitness/targets";
import { cmToInches, fromKg, inchesToCm, toKg, type WeightUnit } from "@/lib/fitness/units";
import { addDays, detectDeviceTimeZone, isValidDateString, localDateString } from "@/lib/time";
import type { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";

interface OnboardingFlowProps {
  userName: string;
  initialWeightUnit: WeightUnit;
}

interface Answers {
  step: number;
  sex: Sex | null;
  birthDate: string;
  unit: WeightUnit;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  goal: FitnessGoal | null;
  stepGoal: number | null;
  waterGoalMl: number | null;
}

const STORAGE_KEY = "ft:onboarding";
const STEP_TITLES = ["About you", "Your body", "How active are you?", "What is your goal?", "Daily goals"];

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string; detail: string }> = [
  { value: "sedentary", label: "Mostly sitting", detail: "Desk job, little or no exercise" },
  { value: "light", label: "Lightly active", detail: "Light exercise 1 to 3 days a week" },
  { value: "moderate", label: "Moderately active", detail: "Exercise 3 to 5 days a week" },
  { value: "active", label: "Very active", detail: "Hard exercise 6 to 7 days a week" },
  { value: "very_active", label: "Extremely active", detail: "Physical job, or training twice a day" },
];

const GOAL_OPTIONS: Array<{ value: FitnessGoal; label: string; detail: string }> = [
  { value: "cut", label: "Lose fat", detail: "Eat a little less than you burn" },
  { value: "maintain", label: "Stay the same", detail: "Eat about what you burn" },
  { value: "bulk", label: "Build muscle", detail: "Eat a little more than you burn" },
];

function loadSaved(): Partial<Answers> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Answers>) : null;
  } catch {
    return null;
  }
}

/** A sensible starting water goal: about 35 ml per kg, in 250 ml steps. */
function suggestedWaterMl(weightKg: number | null): number {
  if (!weightKg) return 2500;
  const rounded = Math.round((weightKg * 35) / 250) * 250;
  return Math.min(4000, Math.max(1500, rounded));
}

export function OnboardingFlow({ userName, initialWeightUnit }: OnboardingFlowProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Answers>(() => ({
    step: 0,
    sex: null,
    birthDate: "",
    unit: initialWeightUnit,
    weightKg: null,
    heightCm: null,
    activityLevel: null,
    goal: null,
    stepGoal: 8000,
    waterGoalMl: null,
    ...(typeof window === "undefined" ? {} : loadSaved() || {}),
  }));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const today = localDateString(new Date(), detectDeviceTimeZone());
  const youngest = addDays(today, -10 * 365);
  const oldest = addDays(today, -100 * 365);

  // Answers survive a reload or a closed tab.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Storage unavailable: the flow still works for this visit.
    }
  }, [answers]);

  // Move focus to the new question so keyboard and screen-reader users follow along.
  const step = answers.step;
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<Answers>) => {
    setError(null);
    setAnswers((current) => ({ ...current, ...patch }));
  };

  const targets = useMemo(
    () =>
      dailyTargets({
        sex: answers.sex,
        birthDate: answers.birthDate || null,
        weightKg: answers.weightKg,
        heightCm: answers.heightCm,
        activityLevel: answers.activityLevel,
        goal: answers.goal,
      }),
    [answers.sex, answers.birthDate, answers.weightKg, answers.heightCm, answers.activityLevel, answers.goal]
  );

  const heightInches = answers.heightCm == null ? null : cmToInches(answers.heightCm, 1);
  const feet = heightInches == null ? null : Math.floor(heightInches / 12);
  const inches = heightInches == null || feet == null ? null : Math.round((heightInches - feet * 12) * 10) / 10;

  const problem = (): string | null => {
    switch (step) {
      case 0:
        if (!answers.sex) return "Choose male or female.";
        if (!isValidDateString(answers.birthDate)) return "Enter your date of birth.";
        if (answers.birthDate > youngest) return "You need to be at least 10 years old to use FitTracker.";
        if (answers.birthDate < oldest) return "Check the year of your date of birth.";
        return null;
      case 1:
        if (answers.weightKg == null) return "Enter your weight.";
        if (answers.weightKg < 30 || answers.weightKg > 300) {
          return answers.unit === "lbs"
            ? "Weight must be between 66 and 661 lbs."
            : "Weight must be between 30 and 300 kg.";
        }
        if (answers.heightCm == null) return "Enter your height.";
        if (answers.heightCm < 100 || answers.heightCm > 250) {
          return answers.unit === "lbs"
            ? "Height must be between 3 ft 4 in and 8 ft 2 in."
            : "Height must be between 100 and 250 cm.";
        }
        return null;
      case 2:
        return answers.activityLevel ? null : "Choose the option closest to your week.";
      case 3:
        return answers.goal ? null : "Choose a goal. You can change it later in Settings.";
      case 4:
        if (answers.stepGoal != null && (answers.stepGoal < 500 || answers.stepGoal > 100_000)) {
          return "The step goal must be between 500 and 100,000.";
        }
        if (answers.waterGoalMl != null && (answers.waterGoalMl < 250 || answers.waterGoalMl > 10_000)) {
          return "The water goal must be between 250 and 10,000 ml.";
        }
        return null;
      default:
        return null;
    }
  };

  const finish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api("/api/onboarding", {
        method: "POST",
        body: {
          sex: answers.sex,
          birthDate: answers.birthDate,
          weightKg: answers.weightKg,
          heightCm: answers.heightCm,
          activityLevel: answers.activityLevel,
          goal: answers.goal,
          stepGoal: answers.stepGoal ?? 8000,
          waterGoalMl: answers.waterGoalMl ?? suggestedWaterMl(answers.weightKg),
          weightUnit: answers.unit,
          timezone: detectDeviceTimeZone(),
        },
      });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clear.
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Your answers could not be saved. Please try again."));
      setIsSaving(false);
    }
  };

  const next = () => {
    const issue = problem();
    if (issue) {
      setError(issue);
      return;
    }
    if (step === STEP_TITLES.length - 1) {
      void finish();
      return;
    }
    // The water goal suggestion needs the weight, so it is filled in on the way to the last step.
    update({
      step: step + 1,
      ...(step === 3 && answers.waterGoalMl == null ? { waterGoalMl: suggestedWaterMl(answers.weightKg) } : {}),
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-app px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-ink">
      <header className="flex items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => update({ step: step - 1 })}
            aria-label="Previous question"
            className="grid h-11 w-11 -ms-2 place-items-center rounded-full text-zinc-300 active:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="h-11 w-9" aria-hidden="true" />
        )}
        <div className="flex-1">
          <p className="text-sm text-zinc-400">
            Step {step + 1} of {STEP_TITLES.length}
          </p>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={STEP_TITLES.length}
            aria-valuenow={step + 1}
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={isSigningOut}
          onClick={() => {
            setIsSigningOut(true);
            void logout();
          }}
          className="min-h-11 rounded-xl px-2 text-sm font-medium text-zinc-400 hover:text-white cursor-pointer"
        >
          Sign out
        </button>
      </header>

      <form
        className="mt-8 flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
        noValidate
      >
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-white outline-none">
          {step === 0 && userName ? `Hi ${userName.split(" ")[0]}. ${STEP_TITLES[0]}` : STEP_TITLES[step]}
        </h1>

        <div className="mt-6 flex-1 space-y-6">
          {step === 0 && (
            <>
              <p className="text-base text-zinc-400">
                These answers are used to estimate how many calories you burn in a day.
              </p>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-zinc-200">Sex</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(["male", "female"] as const).map((value) => (
                    <ChoiceButton
                      key={value}
                      selected={answers.sex === value}
                      onSelect={() => update({ sex: value })}
                      label={value === "male" ? "Male" : "Female"}
                      name="sex"
                    />
                  ))}
                </div>
              </fieldset>
              <div className="space-y-1.5">
                <label htmlFor="onboarding-birth-date" className="block text-sm font-medium text-zinc-200">
                  Date of birth
                </label>
                <input
                  id="onboarding-birth-date"
                  type="date"
                  value={answers.birthDate}
                  min={oldest}
                  max={youngest}
                  autoComplete="bday"
                  onChange={(event) => update({ birthDate: event.target.value })}
                  className="w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3.5 text-base text-white"
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <SegmentedControl
                label="Units"
                value={answers.unit}
                onChange={(unit) => update({ unit })}
                options={[
                  { value: "kg", label: "kg and cm" },
                  { value: "lbs", label: "lbs and ft" },
                ]}
                className="w-full"
              />
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-200">Weight</p>
                <NumberField
                  label={`Weight in ${answers.unit}`}
                  value={answers.weightKg == null ? null : fromKg(answers.weightKg, answers.unit, 1)}
                  onChange={(value) => update({ weightKg: value == null ? null : toKg(value, answers.unit) })}
                  decimals={1}
                  min={0}
                  max={answers.unit === "lbs" ? 700 : 320}
                  suffix={answers.unit}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-200">Height</p>
                {answers.unit === "kg" ? (
                  <NumberField
                    label="Height in centimetres"
                    value={answers.heightCm}
                    onChange={(value) => update({ heightCm: value })}
                    decimals={1}
                    min={0}
                    max={260}
                    suffix="cm"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Height, feet"
                      value={feet}
                      onChange={(value) =>
                        update({ heightCm: value == null ? null : inchesToCm(value * 12 + (inches || 0), 1) })
                      }
                      min={0}
                      max={8}
                      suffix="ft"
                    />
                    <NumberField
                      label="Height, inches"
                      value={inches}
                      onChange={(value) => update({ heightCm: inchesToCm((feet || 0) * 12 + (value || 0), 1) })}
                      decimals={1}
                      min={0}
                      max={11.9}
                      suffix="in"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <fieldset>
              <legend className="sr-only">Activity level</legend>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((option) => (
                  <ChoiceButton
                    key={option.value}
                    selected={answers.activityLevel === option.value}
                    onSelect={() => update({ activityLevel: option.value })}
                    label={option.label}
                    detail={option.detail}
                    name="activity"
                  />
                ))}
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <>
              <fieldset>
                <legend className="sr-only">Goal</legend>
                <div className="space-y-2">
                  {GOAL_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      selected={answers.goal === option.value}
                      onSelect={() => update({ goal: option.value })}
                      label={option.label}
                      detail={option.detail}
                      name="goal"
                    />
                  ))}
                </div>
              </fieldset>
              {answers.goal && targets.calories != null && (
                <div role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-sm text-emerald-200">Your daily targets</p>
                  <p className="mt-1 text-xl font-bold text-white tabular-nums">
                    {targets.calories.toLocaleString("en-US")} kcal
                    {targets.protein != null && (
                      <span className="text-base font-semibold text-zinc-300"> · {targets.protein} g protein</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    An estimate to start from. You can set your own numbers in Settings.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-base text-zinc-400">Suggested starting points. Change them if you like.</p>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-200">Steps per day</p>
                <NumberField
                  label="Steps per day"
                  value={answers.stepGoal}
                  onChange={(value) => update({ stepGoal: value })}
                  min={0}
                  max={100_000}
                  suffix="steps"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-200">Water per day</p>
                <NumberField
                  label="Water per day in millilitres"
                  value={answers.waterGoalMl}
                  onChange={(value) => update({ waterGoalMl: value })}
                  min={0}
                  max={10_000}
                  suffix="ml"
                />
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 mt-6 space-y-3 bg-app px-4 pb-1 pt-3">
          {error && (
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" isLoading={isSaving}>
            {step === STEP_TITLES.length - 1 ? "Finish" : "Continue"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function ChoiceButton({
  selected,
  onSelect,
  label,
  detail,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  detail?: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-emerald-400",
        selected ? "border-emerald-500 bg-emerald-500/15" : "border-line bg-surface"
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          selected ? "border-emerald-500 bg-emerald-500 text-zinc-950" : "border-zinc-500"
        )}
      >
        {selected && <Check className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-white">{label}</span>
        {detail && <span className="block text-sm text-zinc-400">{detail}</span>}
      </span>
    </label>
  );
}

export default OnboardingFlow;
