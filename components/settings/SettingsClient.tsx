"use client";

import React, { useState } from "react";
import { useUser } from "@/context/UserContext";
import { User, Target, Shield, Check, Loader2, Smartphone, RefreshCw } from "lucide-react";
import versionData from "@/version.json";
import { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";
import { SEX_OPTIONS, ACTIVITY_LEVELS, FITNESS_GOALS } from "@/constants/user";

export function SettingsClient() {
  const { user, refreshUser } = useUser();

  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [weightKg, setWeightKg] = useState("75");
  const [heightCm, setHeightCm] = useState("178");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<FitnessGoal>("maintain");
  const [stepGoal, setStepGoal] = useState("10000");
  const [waterGoalMl, setWaterGoalMl] = useState("3000");
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState("90");

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.fitnessProfile?.sex) setSex(user.fitnessProfile.sex);
      if (user.fitnessProfile?.weightKg) setWeightKg(String(user.fitnessProfile.weightKg));
      if (user.fitnessProfile?.heightCm) setHeightCm(String(user.fitnessProfile.heightCm));
      if (user.fitnessProfile?.activityLevel) setActivityLevel(user.fitnessProfile.activityLevel);
      if (user.fitnessProfile?.goal) setGoal(user.fitnessProfile.goal);
      if (user.preferences?.stepGoal) setStepGoal(String(user.preferences.stepGoal));
      if (user.preferences?.waterGoalMl) setWaterGoalMl(String(user.preferences.waterGoalMl));
      if (user.preferences?.restTimerDefaultSec) setRestTimerDefaultSec(String(user.preferences.restTimerDefaultSec));
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setIsSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          fitnessProfile: {
            sex,
            weightKg: parseFloat(weightKg) || null,
            heightCm: parseFloat(heightCm) || null,
            activityLevel,
            goal,
          },
          preferences: {
            stepGoal: parseInt(stepGoal, 10) || 10000,
            waterGoalMl: parseInt(waterGoalMl, 10) || 3000,
            restTimerDefaultSec: parseInt(restTimerDefaultSec, 10) || 90,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update settings");
      }

      await refreshUser();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvalidateAll = async () => {
    if (!confirm("Are you sure you want to log out of all other active sessions?")) return;

    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalidateAllSessions: true }),
      });
      alert("All other sessions have been invalidated.");
      await refreshUser();
    } catch (err) {
      console.error("Failed to invalidate sessions:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Account & Fitness Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Configure your personal metrics, targets, and preferences
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <User className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>Profile & Biometrics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="settings-sex" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Biological Sex
              </label>
              <select
                id="settings-sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                {SEX_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="settings-weight" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Weight (kg)
              </label>
              <input
                id="settings-weight"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="settings-height" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Height (cm)
              </label>
              <input
                id="settings-height"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Targets & Activity Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Target className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>Goals & Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-activity" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Activity Level
              </label>
              <select
                id="settings-activity"
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                {ACTIVITY_LEVELS.map((act) => (
                  <option key={act.key} value={act.key}>
                    {act.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="settings-goal" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Fitness Goal
              </label>
              <select
                id="settings-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value as FitnessGoal)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              >
                {FITNESS_GOALS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="settings-step-goal" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Daily Step Goal
              </label>
              <input
                id="settings-step-goal"
                type="number"
                value={stepGoal}
                onChange={(e) => setStepGoal(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="settings-water-goal" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Daily Hydration Goal (ml)
              </label>
              <input
                id="settings-water-goal"
                type="number"
                value={waterGoalMl}
                onChange={(e) => setWaterGoalMl(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-rest-timer" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
                Default Rest Timer (seconds)
              </label>
              <input
                id="settings-rest-timer"
                type="number"
                value={restTimerDefaultSec}
                onChange={(e) => setRestTimerDefaultSec(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-zinc-950 border border-zinc-700/60 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Computed Targets Overview */}
        {user?.computed && (
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 select-none">
              Automated Metabolic Computation
            </h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block font-semibold">BMR</span>
                <span className="text-lg font-bold text-white block mt-0.5 tabular-nums">{user.computed.bmr || "—"}</span>
                <span className="text-[10px] text-zinc-500">kcal/day</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-orange-400 uppercase block font-semibold">TDEE</span>
                <span className="text-lg font-bold text-orange-300 block mt-0.5 tabular-nums">{user.computed.tdee || "—"}</span>
                <span className="text-[10px] text-zinc-500">kcal/day</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <span className="text-[10px] text-emerald-400 uppercase block font-semibold">Optimal Protein</span>
                <span className="text-lg font-bold text-emerald-300 block mt-0.5 tabular-nums">{user.computed.proteinTargetG || "—"}g</span>
                <span className="text-[10px] text-zinc-500">daily target</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          type="submit"
          disabled={isSaving}
          aria-busy={isSaving}
          className="w-full py-3.5 px-4 min-h-[44px] bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-98"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Saving Changes...</span>
            </>
          ) : isSaved ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <span>Save Preferences</span>
          )}
        </button>
      </form>

      {/* Security & Sessions */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Security & Sessions</span>
        </div>
        <p className="text-xs text-zinc-400">
          Token Version: <strong className="text-zinc-200 tabular-nums">{user?.tokenVersion || 0}</strong>. If you suspect any unauthorized access, you can force log out all other devices immediately.
        </p>
        <button
          type="button"
          onClick={handleInvalidateAll}
          className="px-4 py-2 min-h-[36px] rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-98"
        >
          Log Out All Other Devices
        </button>
      </div>

      {/* App & Version Information */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Smartphone className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>App & Version Information</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold tabular-nums">
            v{versionData.versionName} (Build {versionData.versionCode})
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Running FitTracker {typeof window !== "undefined" && (window as any).AndroidBridge ? "Android Native App" : "Web Platform"}. Automated over-the-air updates check for new features on app launch.
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && (window as any).AndroidBridge?.checkForUpdate) {
              (window as any).AndroidBridge.checkForUpdate();
            } else {
              window.open("https://github.com/MOHAMED-EHAB-DEV/fit-tracker/releases/latest", "_blank");
            }
          }}
          className="px-4 py-2 min-h-[36px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/60 flex items-center gap-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-98"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>Check for Updates</span>
        </button>
      </div>
    </div>
  );
}

export default SettingsClient;
