"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import {
  User,
  Target,
  Shield,
  Check,
  Smartphone,
  RefreshCw,
  Flame,
  Zap,
  Dumbbell,
} from "lucide-react";
import versionData from "@/version.json";
import { ActivityLevel, FitnessGoal, Sex } from "@/types/fitness";
import { SEX_OPTIONS, ACTIVITY_LEVELS, FITNESS_GOALS } from "@/constants/user";
import { isAndroidNativeApp, triggerAppUpdateCheck } from "@/services/webview-bridge";
import { updateProfileSettingsAction } from "@/lib/fitness/actions";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select, SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface SettingsClientProps {
  initialUser?: any;
}

const sexOptions: SelectOption<Sex>[] = SEX_OPTIONS.map((s) => ({
  value: s.value,
  label: s.label,
}));

const activityOptions: SelectOption<ActivityLevel>[] = ACTIVITY_LEVELS.map((act) => ({
  value: act.key,
  label: act.label,
  description: act.desc,
}));

const goalOptions: SelectOption<FitnessGoal>[] = FITNESS_GOALS.map((g) => ({
  value: g.key,
  label: g.label,
  description: g.badge,
}));

export function SettingsClient({ initialUser }: SettingsClientProps = {}) {
  const { user: contextUser, refreshUser } = useUser();
  const user = contextUser || initialUser;

  const [name, setName] = useState(user?.name || "");
  const [sex, setSex] = useState<Sex>(user?.fitnessProfile?.sex || "male");
  const [weightKg, setWeightKg] = useState(user?.fitnessProfile?.weightKg ? String(user.fitnessProfile.weightKg) : "75");
  const [heightCm, setHeightCm] = useState(user?.fitnessProfile?.heightCm ? String(user.fitnessProfile.heightCm) : "178");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(user?.fitnessProfile?.activityLevel || "moderate");
  const [goal, setGoal] = useState<FitnessGoal>(user?.fitnessProfile?.goal || "maintain");
  const [stepGoal, setStepGoal] = useState(user?.preferences?.stepGoal ? String(user.preferences.stepGoal) : "10000");
  const [waterGoalMl, setWaterGoalMl] = useState(user?.preferences?.waterGoalMl ? String(user.preferences.waterGoalMl) : "3000");
  const [restTimerDefaultSec, setRestTimerDefaultSec] = useState(user?.preferences?.restTimerDefaultSec ? String(user.preferences.restTimerDefaultSec) : "90");

  // Macro Targets State
  const [targetCalories, setTargetCalories] = useState(user?.fitnessProfile?.targetCalories ? String(user.fitnessProfile.targetCalories) : "");
  const [targetProteinG, setTargetProteinG] = useState(user?.fitnessProfile?.targetProteinG ? String(user.fitnessProfile.targetProteinG) : "");
  const [targetCarbsG, setTargetCarbsG] = useState(user?.fitnessProfile?.targetCarbsG ? String(user.fitnessProfile.targetCarbsG) : "");
  const [targetFatG, setTargetFatG] = useState(user?.fitnessProfile?.targetFatG ? String(user.fitnessProfile.targetFatG) : "");
  const [targetFiberG, setTargetFiberG] = useState(user?.fitnessProfile?.targetFiberG ? String(user.fitnessProfile.targetFiberG) : "");

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logout modal state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
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

      if (user.fitnessProfile?.targetCalories) setTargetCalories(String(user.fitnessProfile.targetCalories));
      else if (user.computed?.tdee) setTargetCalories(String(user.computed.tdee));

      if (user.fitnessProfile?.targetProteinG) setTargetProteinG(String(user.fitnessProfile.targetProteinG));
      else if (user.computed?.proteinTargetG) setTargetProteinG(String(user.computed.proteinTargetG));

      if (user.fitnessProfile?.targetCarbsG) setTargetCarbsG(String(user.fitnessProfile.targetCarbsG));
      else if (user.computed?.carbsTargetG) setTargetCarbsG(String(user.computed.carbsTargetG));

      if (user.fitnessProfile?.targetFatG) setTargetFatG(String(user.fitnessProfile.targetFatG));
      else if (user.computed?.fatTargetG) setTargetFatG(String(user.computed.fatTargetG));

      if (user.fitnessProfile?.targetFiberG) setTargetFiberG(String(user.fitnessProfile.targetFiberG));
      else if (user.computed?.fiberTargetG) setTargetFiberG(String(user.computed.fiberTargetG));
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setIsSaved(false);
    setError(null);

    try {
      const res = await updateProfileSettingsAction({
        name: name.trim(),
        fitnessProfile: {
          sex,
          weightKg: parseFloat(weightKg) || null,
          heightCm: parseFloat(heightCm) || null,
          activityLevel,
          goal,
          targetCalories: targetCalories ? parseInt(targetCalories, 10) : null,
          targetProteinG: targetProteinG ? parseInt(targetProteinG, 10) : null,
          targetCarbsG: targetCarbsG ? parseInt(targetCarbsG, 10) : null,
          targetFatG: targetFatG ? parseInt(targetFatG, 10) : null,
          targetFiberG: targetFiberG ? parseInt(targetFiberG, 10) : null,
        },
        preferences: {
          stepGoal: parseInt(stepGoal, 10) || 10000,
          waterGoalMl: parseInt(waterGoalMl, 10) || 3000,
          restTimerDefaultSec: parseInt(restTimerDefaultSec, 10) || 90,
        },
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to update settings");
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
    setIsLoggingOut(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalidateAllSessions: true }),
      });
      setIsLogoutModalOpen(false);
      await refreshUser();
    } catch (err) {
      console.error("Failed to invalidate sessions:", err);
    } finally {
      setIsLoggingOut(false);
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
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <User className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span>Profile & Biometrics</span>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
              />

              <Select<Sex>
                label="Biological Sex"
                options={sexOptions}
                value={sex}
                onChange={(val) => setSex(val)}
                placeholder="Select biological sex"
              />

              <Input
                label="Weight (kg)"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 75"
              />

              <Input
                label="Height (cm)"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g. 178"
              />
            </div>
          </CardBody>
        </Card>

        {/* Targets & Activity Card */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Target className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span>Goals & Preferences</span>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select<ActivityLevel>
                label="Activity Level"
                options={activityOptions}
                value={activityLevel}
                onChange={(val) => setActivityLevel(val)}
                placeholder="Select activity level"
              />

              <Select<FitnessGoal>
                label="Fitness Goal"
                options={goalOptions}
                value={goal}
                onChange={(val) => setGoal(val)}
                placeholder="Select fitness goal"
              />

              <Input
                label="Daily Step Goal"
                type="number"
                value={stepGoal}
                onChange={(e) => setStepGoal(e.target.value)}
                placeholder="e.g. 10000"
              />

              <Input
                label="Daily Hydration Goal (ml)"
                type="number"
                value={waterGoalMl}
                onChange={(e) => setWaterGoalMl(e.target.value)}
                placeholder="e.g. 3000"
              />

              <div className="sm:col-span-2">
                <Input
                  label="Default Rest Timer (seconds)"
                  type="number"
                  value={restTimerDefaultSec}
                  onChange={(e) => setRestTimerDefaultSec(e.target.value)}
                  placeholder="e.g. 90"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Customized Macro Targets Card */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Flame className="w-5 h-5 text-orange-400" aria-hidden="true" />
              <span>Nutrition & Macro Targets</span>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            <p className="text-xs text-zinc-400">
              Customize your exact daily nutrition goals. These settings directly power your daily logs and remaining-macro trackers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Target Calories (kcal)"
                type="number"
                value={targetCalories}
                onChange={(e) => setTargetCalories(e.target.value)}
                placeholder="e.g. 2400"
              />

              <Input
                label="Target Protein (g)"
                type="number"
                value={targetProteinG}
                onChange={(e) => setTargetProteinG(e.target.value)}
                placeholder="e.g. 160"
              />

              <Input
                label="Target Carbohydrates (g)"
                type="number"
                value={targetCarbsG}
                onChange={(e) => setTargetCarbsG(e.target.value)}
                placeholder="e.g. 270"
              />

              <Input
                label="Target Fats (g)"
                type="number"
                value={targetFatG}
                onChange={(e) => setTargetFatG(e.target.value)}
                placeholder="e.g. 65"
              />

              <div className="sm:col-span-2">
                <Input
                  label="Target Dietary Fiber (g)"
                  type="number"
                  value={targetFiberG}
                  onChange={(e) => setTargetFiberG(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Computed Targets Overview */}
        {user?.computed && (
          <Card variant="flat" className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
                Automated Metabolic Computation
              </h4>
              <Chip variant="flat" color="primary" size="sm">
                Live Calibrated
              </Chip>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-semibold">
                  <Flame className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                  <span>BMR</span>
                </div>
                <span className="text-lg font-bold text-white block mt-1 tabular-nums">
                  {user.computed.bmr || "—"}
                </span>
                <span className="text-[10px] text-zinc-500">kcal/day</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[10px] text-orange-400 uppercase font-semibold">
                  <Zap className="w-3 h-3 text-orange-400" aria-hidden="true" />
                  <span>TDEE</span>
                </div>
                <span className="text-lg font-bold text-orange-300 block mt-1 tabular-nums">
                  {user.computed.tdee || "—"}
                </span>
                <span className="text-[10px] text-zinc-500">kcal/day</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 flex flex-col items-center justify-center">
                <div className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase font-semibold">
                  <Dumbbell className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  <span>Optimal Protein</span>
                </div>
                <span className="text-lg font-bold text-emerald-300 block mt-1 tabular-nums">
                  {user.computed.proteinTargetG || "—"}g
                </span>
                <span className="text-[10px] text-zinc-500">daily target</span>
              </div>
            </div>
          </Card>
        )}

        {error && (
          <div role="alert" className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Button */}
        <Button
          type="submit"
          variant="solid"
          size="lg"
          isLoading={isSaving}
          startContent={isSaved ? <Check className="w-4 h-4" aria-hidden="true" /> : undefined}
          className="w-full font-bold"
        >
          {isSaved ? "Saved Successfully!" : "Save Preferences"}
        </Button>
      </form>

      {/* Security & Sessions */}
      <Card variant="default">
        <CardHeader>
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Shield className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            <span>Security & Sessions</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Token Version: <strong className="text-zinc-200 tabular-nums">{user?.tokenVersion || 0}</strong>. If you suspect any unauthorized access, you can force log out all other devices immediately.
          </p>
          <div>
            <Button
              type="button"
              variant="bordered"
              size="sm"
              onClick={() => setIsLogoutModalOpen(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              Log Out All Other Devices
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* App & Version Information */}
      <Card variant="default">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Smartphone className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              <span>App & Version Information</span>
            </div>
            <Chip variant="flat" color="primary" size="sm">
              v{versionData.versionName} ({versionData.versionCode})
            </Chip>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Running FitTracker {isAndroidNativeApp() ? "Android Native App" : "Web Platform"}. Automated over-the-air updates check for new features on app launch.
          </p>
          <div>
            <Button
              type="button"
              variant="bordered"
              size="sm"
              onClick={() => triggerAppUpdateCheck()}
              startContent={<RefreshCw className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
            >
              Check for Updates
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Invalidate Sessions Confirm Modal */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleInvalidateAll}
        title="Log Out All Other Devices"
        message="Are you sure you want to invalidate all other active sessions? You will remain logged in on this device only."
        confirmLabel="Log Out Other Devices"
        confirmVariant="danger"
        isLoading={isLoggingOut}
      />
    </div>
  );
}

export default SettingsClient;
