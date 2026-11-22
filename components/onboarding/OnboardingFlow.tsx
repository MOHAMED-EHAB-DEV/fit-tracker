"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { NumberField } from "@/components/ui/NumberField";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { focusFirstInvalid } from "@/components/auth/AuthCard";
import { api, errorMessage } from "@/lib/client/api";
import { logout } from "@/lib/client/logout";
import { cn } from "@/lib/utils";
import { dailyTargets } from "@/lib/fitness/targets";
import { cmToInches, fromKg, inchesToCm, toKg, type WeightUnit } from "@/lib/fitness/units";
import { addDays, detectDeviceTimeZone, isValidDateString, localDateString } from "@/lib/time";
import { PROFILE_LIMITS, profileLimitProblem } from "@/lib/users/limits";
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

type Field = "sex" | "birthDate" | "weightKg" | "heightCm" | "activityLevel" | "goal" | "stepGoal" | "waterGoalMl";
type Errors = Partial<Record<Field, string>>;

const STORAGE_KEY = "ft:onboarding";
const STEP_TITLES = ["About you", "Your body", "How active are you?", "What is your goal?", "Daily goals"];
const LABEL = "mb-1.5 text-[13px] font-medium text-ink-2";

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

/**
 * First-run setup: five short steps (about you, body, activity, goal, daily
 * goals). Continue checks the step and shows each problem under its field;
 * the limits are the ones Settings uses. Rendered in the browser only (the
 * answers are kept on the device until Finish).
 */
export function OnboardingFlow({ userName, initialWeightUnit }: OnboardingFlowProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
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
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const today = localDateString(new Date(), detectDeviceTimeZone());
  const youngest = addDays(today, -PROFILE_LIMITS.age.min * 365);
  const oldest = addDays(today, -PROFILE_LIMITS.age.max * 365);
  const step = Math.min(Math.max(0, answers.step), STEP_TITLES.length - 1);
  const unit = answers.unit;

  // Answers survive a reload or a closed tab.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Storage unavailable: the flow still works for this visit.
    }
  }, [answers]);

  // Move focus to the new question so keyboard and screen-reader users follow along.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<Answers>) => {
    setFormError(null);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as Field];
      return next;
    });
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

  /** The problems on the current step, by field. */
  const problems = (): Errors => {
    const found: Errors = {};
    const limit = (field: "weightKg" | "heightCm" | "stepGoal" | "waterGoalMl") => {
      const problem = profileLimitProblem(field, answers[field], unit);
      if (problem) found[field] = problem;
    };
    switch (step) {
      case 0:
        if (!answers.sex) found.sex = "Choose male or female.";
        if (!isValidDateString(answers.birthDate)) found.birthDate = "Enter your date of birth.";
        else if (answers.birthDate > youngest) found.birthDate = `You need to be at least ${PROFILE_LIMITS.age.min} years old to use FitTracker.`;
        else if (answers.birthDate < oldest) found.birthDate = "Check the year of your date of birth.";
        break;
      case 1:
        if (answers.weightKg == null) found.weightKg = "Enter your weight.";
        else limit("weightKg");
        if (answers.heightCm == null) found.heightCm = "Enter your height.";
        else limit("heightCm");
        break;
      case 2:
        if (!answers.activityLevel) found.activityLevel = "Choose the option closest to your week.";
        break;
      case 3:
        if (!answers.goal) found.goal = "Choose a goal. You can change it later in Settings.";
        break;
      case 4:
        limit("stepGoal");
        limit("waterGoalMl");
        break;
    }
    return found;
  };

  const finish = async () => {
    setIsSaving(true);
    setFormError(null);
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
          weightUnit: unit,
          timezone: detectDeviceTimeZone(),
        },
      });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clear.
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(errorMessage(err, "Your answers could not be saved. Please try again."));
      setIsSaving(false);
    }
  };

  const next = () => {
    const found = problems();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid(formRef.current);
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
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col bg-canvas px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-ink">
      <header className="flex items-center gap-2">
        {step > 0 ? (
          <IconButton
            label="Previous question"
            icon={<ArrowLeft className="h-5 w-5" />}
            onClick={() => update({ step: step - 1 })}
            className="-ms-2"
          />
        ) : (
          <span className="h-11 w-9" aria-hidden="true" />
        )}
        <div className="flex-1">
          <p className="text-[13px] text-ink-2">
            Step <span className="font-mono tabular-nums">{step + 1}</span> of{" "}
            <span className="font-mono tabular-nums">{STEP_TITLES.length}</span>
          </p>
          <ProgressTrack value={step + 1} max={STEP_TITLES.length} tone="accent" label="Setup progress" className="mt-1.5" />
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isSigningOut}
          onClick={() => {
            setIsSigningOut(true);
            void logout();
          }}
        >
          Sign out
        </Button>
      </header>

      <form
        ref={formRef}
        className="mt-8 flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
        noValidate
      >
        <h1 ref={headingRef} tabIndex={-1} className="text-title text-ink outline-none">
          {step === 0 && userName ? `Hi ${userName.split(" ")[0]}. ${STEP_TITLES[0]}` : STEP_TITLES[step]}
        </h1>

        <div className="mt-6 flex-1 space-y-6">
          {step === 0 && (
            <>
              <p className="text-sm leading-6 text-ink-2">These answers are used to estimate how many calories you burn in a day.</p>
              <ChoiceGroup legend="Sex" error={errors.sex} errorId="onboarding-sex-error">
                <div className="grid grid-cols-2 gap-3">
                  {(["male", "female"] as const).map((value) => (
                    <ChoiceButton
                      key={value}
                      selected={answers.sex === value}
                      onSelect={() => update({ sex: value })}
                      label={value === "male" ? "Male" : "Female"}
                      name="sex"
                      errorId={errors.sex ? "onboarding-sex-error" : undefined}
                    />
                  ))}
                </div>
              </ChoiceGroup>
              <Input
                id="onboarding-birth-date"
                label="Date of birth"
                type="date"
                value={answers.birthDate}
                min={oldest}
                max={youngest}
                autoComplete="bday"
                onChange={(event) => update({ birthDate: event.target.value })}
                isInvalid={Boolean(errors.birthDate)}
                errorMessage={errors.birthDate}
                inputClassName="font-mono tabular-nums"
              />
            </>
          )}

          {step === 1 && (
            <>
              <SegmentedControl
                label="Units"
                value={unit}
                onChange={(value) => update({ unit: value })}
                options={[
                  { value: "kg", label: "kg and cm" },
                  { value: "lbs", label: "lbs and ft" },
                ]}
                className="w-full"
              />
              <div>
                <p className={LABEL}>Weight</p>
                <NumberField
                  label={`Weight in ${unit}`}
                  value={answers.weightKg == null ? null : fromKg(answers.weightKg, unit, 1)}
                  onChange={(value) => update({ weightKg: value == null ? null : toKg(value, unit) })}
                  decimals={1}
                  suffix={unit}
                  errorMessage={errors.weightKg}
                />
              </div>
              <div>
                <p className={LABEL}>Height</p>
                {unit === "kg" ? (
                  <NumberField
                    label="Height in centimetres"
                    value={answers.heightCm}
                    onChange={(value) => update({ heightCm: value })}
                    decimals={1}
                    suffix="cm"
                    errorMessage={errors.heightCm}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField
                        label="Height, feet"
                        value={feet}
                        onChange={(value) => update({ heightCm: value == null ? null : inchesToCm(value * 12 + (inches || 0), 1) })}
                        max={8}
                        suffix="ft"
                        isInvalid={Boolean(errors.heightCm)}
                        describedBy={errors.heightCm ? "onboarding-height-error" : undefined}
                      />
                      <NumberField
                        label="Height, inches"
                        value={inches}
                        onChange={(value) => update({ heightCm: inchesToCm((feet || 0) * 12 + (value || 0), 1) })}
                        decimals={1}
                        max={11.9}
                        suffix="in"
                        isInvalid={Boolean(errors.heightCm)}
                        describedBy={errors.heightCm ? "onboarding-height-error" : undefined}
                      />
                    </div>
                    {errors.heightCm && (
                      <p id="onboarding-height-error" className="mt-1.5 text-xs text-danger">
                        {errors.heightCm}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <ChoiceGroup legend="Activity level" hideLegend error={errors.activityLevel} errorId="onboarding-activity-error">
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((option) => (
                  <ChoiceButton
                    key={option.value}
                    selected={answers.activityLevel === option.value}
                    onSelect={() => update({ activityLevel: option.value })}
                    label={option.label}
                    detail={option.detail}
                    name="activity"
                    errorId={errors.activityLevel ? "onboarding-activity-error" : undefined}
                  />
                ))}
              </div>
            </ChoiceGroup>
          )}

          {step === 3 && (
            <>
              <ChoiceGroup legend="Goal" hideLegend error={errors.goal} errorId="onboarding-goal-error">
                <div className="space-y-2">
                  {GOAL_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      selected={answers.goal === option.value}
                      onSelect={() => update({ goal: option.value })}
                      label={option.label}
                      detail={option.detail}
                      name="goal"
                      errorId={errors.goal ? "onboarding-goal-error" : undefined}
                    />
                  ))}
                </div>
              </ChoiceGroup>
              {answers.goal && targets.calories != null && (
                <div role="status" className="rounded-card border border-line bg-surface p-4">
                  <p className="text-[13px] font-medium text-ink-2">Your daily targets</p>
                  <p className="mt-1 font-mono text-title tabular-nums text-ink">
                    {targets.calories.toLocaleString("en-US")}
                    <span className="ms-1 font-sans text-sm font-medium text-ink-2">kcal</span>
                    {targets.protein != null && (
                      <>
                        <span className="mx-2 text-ink-3" aria-hidden="true">
                          ·
                        </span>
                        {targets.protein}
                        <span className="ms-1 font-sans text-sm font-medium text-ink-2">g protein</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1.5 text-[13px] text-ink-3">An estimate to start from. You can set your own numbers in Settings.</p>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm leading-6 text-ink-2">Suggested starting points. Change them if you like.</p>
              <div>
                <p className={LABEL}>Steps per day</p>
                <NumberField
                  label="Steps per day"
                  value={answers.stepGoal}
                  onChange={(value) => update({ stepGoal: value })}
                  suffix="steps"
                  errorMessage={errors.stepGoal}
                />
              </div>
              <div>
                <p className={LABEL}>Water per day</p>
                <NumberField
                  label="Water per day in millilitres"
                  value={answers.waterGoalMl}
                  onChange={(value) => update({ waterGoalMl: value })}
                  suffix="ml"
                  errorMessage={errors.waterGoalMl}
                />
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 mt-6 space-y-3 bg-canvas px-4 pb-1 pt-3">
          {formError && (
            <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
              {formError}
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

function ChoiceGroup({
  legend,
  hideLegend = false,
  error,
  errorId,
  children,
}: {
  legend: string;
  hideLegend?: boolean;
  error?: string;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : LABEL}>{legend}</legend>
      {children}
      {error && (
        <p id={errorId} className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ChoiceButton({
  selected,
  onSelect,
  label,
  detail,
  name,
  errorId,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  detail?: string;
  name: string;
  /** Set while the group has a problem: the radios point at its message. */
  errorId?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 transition-colors has-focus-visible:outline-[1.5px] has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        selected
          ? "border-accent bg-accent-soft"
          : errorId
            ? "border-danger bg-surface"
            : "border-line bg-surface hover:border-line-strong"
      )}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        aria-describedby={errorId}
        data-invalid={errorId ? "" : undefined}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-accent bg-accent text-ink-inverse" : "border-line-strong"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {detail && <span className="block text-[13px] text-ink-2">{detail}</span>}
      </span>
    </label>
  );
}

export default OnboardingFlow;
