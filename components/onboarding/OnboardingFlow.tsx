"use client";

import React, { useState, useMemo } from "react";
import {
  Dumbbell,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Footprints,
  Droplets,
  Clock,
  Loader2,
  AlertCircle,
  Ruler,
  Scale,
} from "lucide-react";
import { Sex, ActivityLevel, FitnessGoal } from "@/types/fitness";
import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateProteinTarget } from "@/lib/fitness/bmr";
import { InteractiveRuler } from "@/components/onboarding/InteractiveRuler";
import { ACTIVITY_LEVELS, FITNESS_GOALS } from "@/constants/user";
import { REST_TIMER_PRESETS } from "@/constants/workout";

export function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Step 1: Sex & Age
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("25");

  // Step 2: Height & Unit
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [heightVal, setHeightVal] = useState(175);

  // Step 3: Weight & Unit
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weightVal, setWeightVal] = useState(75.0);

  // Step 4: Activity & Goal
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>("moderate");
  const [goal, setGoal] = useState<FitnessGoal | null>("maintain");

  // Step 5: Habits
  const [stepGoal, setStepGoal] = useState("10000");
  const [waterGoalMl, setWaterGoalMl] = useState("3000");
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState("90");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize height to cm and weight to kg for calculations
  const normalizedHeightCm = useMemo(() => {
    if (heightUnit === "cm") return heightVal;
    return Math.round(heightVal * 2.54);
  }, [heightVal, heightUnit]);

  const normalizedWeightKg = useMemo(() => {
    if (weightUnit === "kg") return weightVal;
    return parseFloat((weightVal * 0.453592).toFixed(1));
  }, [weightVal, weightUnit]);

  // Secondary display strings for rulers
  const heightSecondary = useMemo(() => {
    if (heightUnit === "cm") {
      const totalInches = heightVal / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return `≈ ${feet}' ${inches}" (${totalInches.toFixed(1)} in)`;
    } else {
      const cm = Math.round(heightVal * 2.54);
      return `≈ ${cm} cm`;
    }
  }, [heightVal, heightUnit]);

  const weightSecondary = useMemo(() => {
    if (weightUnit === "kg") {
      const lbs = (weightVal * 2.20462).toFixed(1);
      return `≈ ${lbs} lbs`;
    } else {
      const kg = (weightVal * 0.453592).toFixed(1);
      return `≈ ${kg} kg`;
    }
  }, [weightVal, weightUnit]);

  // Unit switch handlers with conversion
  const handleHeightUnitChange = (newUnit: string) => {
    if (newUnit === heightUnit) return;
    if (newUnit === "in") {
      setHeightVal(Math.round(heightVal / 2.54));
    } else {
      setHeightVal(Math.round(heightVal * 2.54));
    }
    setHeightUnit(newUnit as "cm" | "in");
  };

  const handleWeightUnitChange = (newUnit: string) => {
    if (newUnit === weightUnit) return;
    if (newUnit === "lbs") {
      setWeightVal(parseFloat((weightVal * 2.20462).toFixed(1)));
    } else {
      setWeightVal(parseFloat((weightVal * 0.453592).toFixed(1)));
    }
    setWeightUnit(newUnit as "kg" | "lbs");
  };

  // Live Calculations for Preview
  const computedMetrics = useMemo(() => {
    const w = normalizedWeightKg;
    const h = normalizedHeightCm;
    const a = parseInt(age, 10);
    const s = sex;
    const act = activityLevel;
    const g = goal;

    if (w && h && a && s && act && g) {
      const bmr = calculateBMR(w, h, a, s);
      const tdee = calculateTDEE(bmr, act);
      const targetCalories = calculateTargetCalories(tdee, g);
      const targetProtein = calculateProteinTarget(w, g);
      return { bmr, tdee, targetCalories, targetProtein };
    }
    return null;
  }, [normalizedWeightKg, normalizedHeightCm, age, sex, activityLevel, goal]);

  const handleNext = () => {
    setError(null);
    if (step === 1 && (!sex || !age || parseInt(age, 10) < 14)) {
      setError("Please select your biological sex and enter a valid age.");
      return;
    }
    if (step === 2 && (normalizedHeightCm < 100 || normalizedHeightCm > 250)) {
      setError("Please select a valid height.");
      return;
    }
    if (step === 3 && (normalizedWeightKg < 30 || normalizedWeightKg > 300)) {
      setError("Please select a valid weight.");
      return;
    }
    if (step === 4 && (!activityLevel || !goal)) {
      setError("Please select your activity level and fitness goal.");
      return;
    }
    if (step === 5 && (!stepGoal || !waterGoalMl || !restTimerDefaultSec)) {
      setError("Please verify your daily targets.");
      return;
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sex,
          age,
          weightKg: normalizedWeightKg,
          heightCm: normalizedHeightCm,
          activityLevel,
          goal,
          stepGoal,
          waterGoalMl,
          restTimerDefaultSec,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete profile setup");
      }

      // Hard redirect to reload shell with updated complete profile in DB
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.");
      setIsSubmitting(false);
    }
  };

  const progressPct = Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-emerald-500 selection:text-zinc-950">
      {/* Background Decorative Blur */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10 space-y-6">
        {/* Top Header & Brand */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight">AI Fit Tracker</span>
              <span className="text-[11px] text-zinc-500 block">Personal Profile Setup</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-emerald-400">Step {step} of {totalSteps}</span>
            <span className="text-[10px] text-zinc-500 block">{progressPct}% completed</span>
          </div>
        </header>

        {/* Dynamic Animated Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile setup progress"
          className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80"
        >
          <div
            className="h-full bg-linear-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-500 ease-out shadow-sm shadow-emerald-500/50"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Main Step Container */}
        <main className="p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-6 text-zinc-100">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: SEX & AGE */}
          {step === 1 && (
            <section aria-labelledby="step1-title" className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h1 id="step1-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  What is your biological sex & age?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Required for baseline metabolic calculations (Mifflin-St Jeor equation).
                </p>
              </div>

              {/* Sex Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Biological Sex *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSex("male")}
                    className={`py-4 px-4 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-sm transition ${
                      sex === "male"
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span>Male</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSex("female")}
                    className={`py-4 px-4 rounded-2xl border flex items-center justify-center gap-2.5 font-bold text-sm transition ${
                      sex === "female"
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span>Female</span>
                  </button>
                </div>
              </div>

              {/* Age */}
              <div>
                <label htmlFor="age-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Age (Years) *
                </label>
                <input
                  id="age-input"
                  type="number"
                  min="14"
                  max="100"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </section>
          )}

          {/* STEP 2: HEIGHT WITH INTERACTIVE RULER */}
          {step === 2 && (
            <section aria-labelledby="step2-title" className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-2">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Height Measurement</span>
                </div>
                <h1 id="step2-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  How tall are you?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Drag the ruler or use the arrows to set your exact height.
                </p>
              </div>

              <InteractiveRuler
                value={heightVal}
                onChange={setHeightVal}
                min={heightUnit === "cm" ? 100 : 39}
                max={heightUnit === "cm" ? 250 : 98}
                step={1}
                unit={heightUnit}
                activeUnit={heightUnit}
                unitOptions={[
                  { label: "Centimeters (cm)", value: "cm" },
                  { label: "Inches (in / ft)", value: "in" },
                ]}
                onUnitChange={handleHeightUnitChange}
                majorInterval={heightUnit === "cm" ? 10 : 6}
                secondaryDisplay={heightSecondary}
                ariaLabel="Height measurement ruler"
              />
            </section>
          )}

          {/* STEP 3: WEIGHT WITH INTERACTIVE RULER */}
          {step === 3 && (
            <section aria-labelledby="step3-title" className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold mb-2">
                  <Scale className="w-3.5 h-3.5" />
                  <span>Bodyweight Measurement</span>
                </div>
                <h1 id="step3-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  What is your current weight?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  We use your weight to establish protein targets and calculate maintenance TDEE.
                </p>
              </div>

              <InteractiveRuler
                value={weightVal}
                onChange={setWeightVal}
                min={weightUnit === "kg" ? 30 : 66}
                max={weightUnit === "kg" ? 250 : 550}
                step={0.1}
                unit={weightUnit}
                activeUnit={weightUnit}
                unitOptions={[
                  { label: "Kilograms (kg)", value: "kg" },
                  { label: "Pounds (lbs)", value: "lbs" },
                ]}
                onUnitChange={handleWeightUnitChange}
                majorInterval={weightUnit === "kg" ? 5 : 10}
                secondaryDisplay={weightSecondary}
                ariaLabel="Weight measurement ruler"
              />
            </section>
          )}

          {/* STEP 4: ACTIVITY LEVEL & GOAL */}
          {step === 4 && (
            <section aria-labelledby="step4-title" className="space-y-5 animate-in fade-in duration-300">
              <div>
                <h1 id="step4-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Activity Level & Fitness Goal
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  We calibrate your daily expenditure multiplier and macro split from these choices.
                </p>
              </div>

              {/* Activity Level List */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Daily Physical Activity *
                </label>
                {ACTIVITY_LEVELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActivityLevel(item.key as ActivityLevel)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                      activityLevel === item.key
                        ? "bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm text-white block">{item.label}</span>
                      <span className="text-xs text-zinc-400">{item.desc}</span>
                    </div>
                    {activityLevel === item.key && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Fitness Goal */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Target Physique Goal *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {FITNESS_GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGoal(g.key as FitnessGoal)}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center transition ${
                        goal === g.key
                          ? "bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500 shadow-md"
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="font-bold text-xs sm:text-sm text-white block">{g.title}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">{g.badge}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* STEP 5: HABITS & TARGETS */}
          {step === 5 && (
            <section aria-labelledby="step5-title" className="space-y-5 animate-in fade-in duration-300">
              <div>
                <h1 id="step5-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Daily Targets & Workout Habits
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Customize your daily step goals, hydration, and gym rest intervals.
                </p>
              </div>

              <div className="space-y-4">
                {/* Steps */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Footprints className="w-4 h-4 text-blue-400" />
                      <span>Daily Step Target</span>
                    </span>
                    <span className="text-sm font-extrabold text-white">{parseInt(stepGoal, 10).toLocaleString()} steps</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="20000"
                    step="500"
                    value={stepGoal}
                    onChange={(e) => setStepGoal(e.target.value)}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>5,000</span>
                    <span>10,000 (Recommended)</span>
                    <span>20,000</span>
                  </div>
                </div>

                {/* Hydration */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-400" />
                      <span>Daily Hydration Target</span>
                    </span>
                    <span className="text-sm font-extrabold text-white">{(parseInt(waterGoalMl, 10) / 1000).toFixed(1)} Liters</span>
                  </div>
                  <input
                    type="range"
                    min="1500"
                    max="5000"
                    step="250"
                    value={waterGoalMl}
                    onChange={(e) => setWaterGoalMl(e.target.value)}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>1.5L</span>
                    <span>3.0L (Optimal)</span>
                    <span>5.0L</span>
                  </div>
                </div>

                {/* Rest Timer */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Default Gym Rest Timer</span>
                    </span>
                    <span className="text-sm font-extrabold text-white">{restTimerDefaultSec} seconds</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {REST_TIMER_PRESETS.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setRestTimerDefaultSec(sec)}
                        className={`py-2 rounded-xl text-xs font-bold transition border ${
                          restTimerDefaultSec === sec
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 6: CALCULATION PREVIEW & CONFIRMATION */}
          {step === 6 && computedMetrics && (
            <section aria-labelledby="step6-title" className="space-y-6 animate-in fade-in duration-300">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Calculated Metabolic Blueprint</span>
                </div>
                <h1 id="step6-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Your Personalized Targets
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Based on {normalizedWeightKg}kg weight, {normalizedHeightCm}cm height, {age} years, and {goal} goal.
                </p>
              </div>

              {/* 4 Computed Cards */}
              <div className="grid grid-cols-2 gap-3.5">
                <article className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Basal Metabolic Rate</span>
                  <span className="text-2xl font-extrabold text-white block">{computedMetrics.bmr.toLocaleString()}</span>
                  <span className="text-[11px] text-zinc-400">kcal/day at complete rest</span>
                </article>

                <article className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block">Maintenance TDEE</span>
                  <span className="text-2xl font-extrabold text-orange-300 block">{computedMetrics.tdee.toLocaleString()}</span>
                  <span className="text-[11px] text-zinc-400">total daily expenditure</span>
                </article>

                <article className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Daily Calorie Target</span>
                  <span className="text-2xl font-extrabold text-emerald-300 block">{computedMetrics.targetCalories.toLocaleString()}</span>
                  <span className="text-[11px] text-emerald-400/80 font-medium">{goal === "cut" ? "-500 kcal deficit" : goal === "bulk" ? "+300 kcal surplus" : "Maintenance target"}</span>
                </article>

                <article className="p-4 rounded-2xl bg-zinc-950/80 border border-teal-500/30 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Optimal Protein</span>
                  <span className="text-2xl font-extrabold text-teal-300 block">{computedMetrics.targetProtein}g</span>
                  <span className="text-[11px] text-teal-400/80 font-medium">~2.0-2.2g per kg bodyweight</span>
                </article>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <div className="flex justify-between">
                  <span>Daily Step Goal:</span>
                  <span className="font-bold text-white">{parseInt(stepGoal, 10).toLocaleString()} steps</span>
                </div>
                <div className="flex justify-between">
                  <span>Hydration Target:</span>
                  <span className="font-bold text-white">{(parseInt(waterGoalMl, 10) / 1000).toFixed(1)}L / day</span>
                </div>
              </div>
            </section>
          )}

          {/* Navigation Buttons */}
          <footer className="flex items-center justify-between pt-4 border-t border-zinc-800/80 gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting Up Account...</span>
                  </>
                ) : (
                  <>
                    <span>Finish Setup & Launch</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

export default OnboardingFlow;
