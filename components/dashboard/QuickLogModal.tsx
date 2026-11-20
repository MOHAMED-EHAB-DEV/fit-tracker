"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Droplets, Footprints, Plus, Scale, Undo2, UtensilsCrossed } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { WATER_QUICK_AMOUNTS } from "@/constants/nutrition";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";
import { useUser } from "@/hooks/useUser";
import { MealForm } from "@/components/nutrition/MealForm";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { newMealDraft, validateDraft, type MealDraft } from "@/lib/nutrition/draft";
import { createMealRequest, readApiResponse } from "@/lib/nutrition/client";
import { logWaterAction } from "@/lib/nutrition/actions";
import { formatAmount } from "@/lib/nutrition/totals";
import { toKg } from "@/lib/fitness/units";
import { cn } from "@/lib/utils";

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWaterMl: number;
}

type TabType = "food" | "water" | "weight" | "steps";

const TABS: Array<{ id: TabType; label: string; icon: React.ReactNode; ring: string; active: string }> = [
  { id: "food", label: "Food", icon: <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />, ring: "focus-visible:ring-emerald-400", active: "text-emerald-300" },
  { id: "water", label: "Water", icon: <Droplets className="w-4 h-4" aria-hidden="true" />, ring: "focus-visible:ring-cyan-400", active: "text-cyan-300" },
  { id: "weight", label: "Weight", icon: <Scale className="w-4 h-4" aria-hidden="true" />, ring: "focus-visible:ring-amber-400", active: "text-amber-300" },
  { id: "steps", label: "Steps", icon: <Footprints className="w-4 h-4" aria-hidden="true" />, ring: "focus-visible:ring-blue-400", active: "text-blue-300" },
];

/** Body weight bounds per display unit (kg 20-400). */
const WEIGHT_BOUNDS = { kg: { min: 20, max: 400 }, lbs: { min: 44, max: 880 } } as const;
const MAX_STEPS = 100_000;

const fieldClass =
  "w-full min-h-11 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm tabular-nums focus:outline-none focus-visible:ring-2";

export function QuickLogModal({ isOpen, onClose, initialWaterMl }: QuickLogModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tz = useUserTimeZone();
  const { weightUnit } = useUser();
  const { isNative, steps: nativeSteps } = useNativeStepTracker();

  const [activeTab, setActiveTab] = useState<TabType>("food");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Food
  const [draft, setDraft] = useState<MealDraft>(() => newMealDraft(todayInZone(tz), tz));
  const [today, setToday] = useState(() => todayInZone(tz));

  // Water
  const [waterMl, setWaterMl] = useState(initialWaterMl);
  const [lastWater, setLastWater] = useState<number | null>(null);
  const [lastWaterDay, setLastWaterDay] = useState<string | undefined>(undefined);

  // Weight / steps
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [steps, setSteps] = useState("");

  // Each time the dialog opens, start from a fresh form on the user's current day.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const now = todayInZone(tz);
      setToday(now);
      setDraft(newMealDraft(now, tz));
      setWaterMl(initialWaterMl);
      setLastWater(null);
      setWeight("");
      setBodyFat("");
      setSteps("");
      setError(null);
    }
  }

  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const logFood = () =>
    run(async () => {
      const checked = validateDraft(draft, todayInZone(tz));
      if (!checked.ok) throw new Error(checked.error);
      await createMealRequest(checked.payload);
      toast("Meal logged", "success");
      onClose();
      router.refresh();
    });

  const changeWater = (amount: number, isUndo: boolean) =>
    run(async () => {
      const result = await logWaterAction(amount, isUndo ? lastWaterDay : undefined);
      if (!result.success || typeof result.waterMl !== "number") {
        throw new Error(result.error || "Water could not be saved.");
      }
      setWaterMl(result.waterMl);
      setLastWater(isUndo ? null : amount);
      setLastWaterDay(isUndo ? undefined : result.dateString);
      router.refresh();
    });

  const logWeight = () =>
    run(async () => {
      const bounds = WEIGHT_BOUNDS[weightUnit];
      const value = Number(weight.replace(",", "."));
      if (!weight.trim() || !Number.isFinite(value) || value < bounds.min || value > bounds.max) {
        throw new Error(`Enter a weight between ${bounds.min} and ${bounds.max} ${weightUnit}.`);
      }
      let bodyFatPercent: number | null = null;
      if (bodyFat.trim()) {
        const fat = Number(bodyFat.replace(",", "."));
        if (!Number.isFinite(fat) || fat < 2 || fat > 70) throw new Error("Body fat should be between 2 and 70 %.");
        bodyFatPercent = Math.round(fat * 10) / 10;
      }
      // Two decimals, so a weight entered in lbs reads back exactly (165 lbs, not 164.9).
      const weightKg = Math.round(toKg(value, weightUnit) * 100) / 100;
      const response = await fetch("/api/body-comp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: weightKg, bodyFatPercent }),
      });
      await readApiResponse(response);
      toast("Weight saved", "success");
      onClose();
      router.refresh();
    });

  const logSteps = () =>
    run(async () => {
      const value = Number(steps);
      if (!steps.trim() || !Number.isInteger(value) || value < 0 || value > MAX_STEPS) {
        throw new Error(`Enter a whole number of steps between 0 and ${MAX_STEPS.toLocaleString("en-US")}.`);
      }
      const response = await fetch("/api/steps/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: value, source: "manual", dateString: todayInZone(tz) }),
      });
      await readApiResponse(response);
      toast("Steps saved", "success");
      onClose();
      router.refresh();
    });

  const weightBounds = WEIGHT_BOUNDS[weightUnit];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      size={activeTab === "food" ? "2xl" : "md"}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400" aria-hidden="true">
            <Plus className="w-4 h-4" />
          </div>
          <span>Quick log</span>
        </div>
      }
      closeOnBackdropClick={!busy}
    >
      <div className="space-y-4">
        <div role="tablist" aria-label="What to log" className="grid grid-cols-4 p-1.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-sm font-semibold gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`quick-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`quick-panel-${tab.id}`}
              disabled={busy}
              onClick={() => {
                setActiveTab(tab.id);
                setError(null);
              }}
              className={cn(
                "min-h-11 px-1 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus-visible:ring-2",
                tab.ring,
                activeTab === tab.id ? cn("bg-zinc-800 shadow-sm", tab.active) : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {error && activeTab !== "food" && (
          <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium">
            {error}
          </div>
        )}

        {activeTab === "food" && (
          <form
            id="quick-panel-food"
            role="tabpanel"
            aria-labelledby="quick-tab-food"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              logFood();
            }}
            className="space-y-4"
          >
            <MealForm idPrefix="quick-food" draft={draft} onChange={setDraft} maxDate={today} disabled={busy} error={error} />
            <Button type="submit" variant="solid" size="lg" className="w-full" isLoading={busy} disabled={busy}>
              Log food
            </Button>
          </form>
        )}

        {activeTab === "water" && (
          <div id="quick-panel-water" role="tabpanel" aria-labelledby="quick-tab-water" className="space-y-4 text-center">
            <p className="text-sm text-zinc-300" aria-live="polite">
              Today: <strong className="text-cyan-300 tabular-nums">{formatAmount(waterMl)} ml</strong>
              {lastWater !== null && (
                <span className="inline-flex items-center gap-1 ms-2 text-emerald-300">
                  <Check className="w-4 h-4" aria-hidden="true" /> added {lastWater} ml
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {WATER_QUICK_AMOUNTS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => changeWater(ml, false)}
                  disabled={busy}
                  aria-label={`Add ${ml} millilitres of water`}
                  className="py-3 px-3 min-h-14 rounded-2xl bg-zinc-950 border border-cyan-500/20 hover:border-cyan-500/60 hover:bg-cyan-500/10 font-bold transition flex flex-col items-center gap-1 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
                >
                  <span className="text-base text-white tabular-nums">+{ml} ml</span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {ml === 250 ? "1 glass" : ml === 500 ? "1 bottle" : `${ml / 1000} L`}
                  </span>
                </button>
              ))}
            </div>
            {lastWater !== null && (
              <Button
                type="button"
                variant="bordered"
                size="md"
                onClick={() => changeWater(-lastWater, true)}
                disabled={busy}
                startContent={<Undo2 className="w-4 h-4" />}
              >
                Undo +{lastWater} ml
              </Button>
            )}
          </div>
        )}

        {activeTab === "weight" && (
          <form
            id="quick-panel-weight"
            role="tabpanel"
            aria-labelledby="quick-tab-weight"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              logWeight();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="quick-weight-val" className="block text-xs font-semibold text-zinc-300 mb-1">
                Body weight ({weightUnit}) *
              </label>
              <input
                id="quick-weight-val"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={weightBounds.min}
                max={weightBounds.max}
                required
                placeholder={weightUnit === "kg" ? "e.g. 74.8" : "e.g. 165"}
                value={weight}
                disabled={busy}
                onChange={(event) => setWeight(event.target.value)}
                className={cn(fieldClass, "focus-visible:ring-amber-500")}
              />
            </div>
            <div>
              <label htmlFor="quick-weight-bf" className="block text-xs font-semibold text-zinc-300 mb-1">
                Body fat % (optional)
              </label>
              <input
                id="quick-weight-bf"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={2}
                max={70}
                placeholder="e.g. 14.5"
                value={bodyFat}
                disabled={busy}
                onChange={(event) => setBodyFat(event.target.value)}
                className={cn(fieldClass, "focus-visible:ring-amber-500")}
              />
            </div>
            <Button type="submit" variant="solid" size="lg" className="w-full" isLoading={busy} disabled={busy}>
              Save weight
            </Button>
          </form>
        )}

        {activeTab === "steps" && (
          <form
            id="quick-panel-steps"
            role="tabpanel"
            aria-labelledby="quick-tab-steps"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              logSteps();
            }}
            className="space-y-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="quick-steps-val" className="block text-xs font-semibold text-zinc-300">
                  Total steps today *
                </label>
                {isNative && nativeSteps > 0 && (
                  <button
                    type="button"
                    onClick={() => setSteps(String(nativeSteps))}
                    className="min-h-11 px-2 text-sm font-semibold text-blue-300 hover:text-blue-200 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg"
                  >
                    Use phone count ({nativeSteps.toLocaleString("en-US")})
                  </button>
                )}
              </div>
              <input
                id="quick-steps-val"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_STEPS}
                step={1}
                required
                placeholder="e.g. 8500"
                value={steps}
                disabled={busy}
                onChange={(event) => setSteps(event.target.value)}
                className={cn(fieldClass, "focus-visible:ring-blue-500")}
              />
            </div>
            <Button type="submit" variant="solid" size="lg" className="w-full" isLoading={busy} disabled={busy}>
              Save steps
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default QuickLogModal;
