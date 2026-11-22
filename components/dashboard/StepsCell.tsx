"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { LedgerLabel, LedgerValue } from "@/components/dashboard/FuelLedger";
import { useLiveToday } from "@/components/habits/useLiveToday";
import { useNativeStepTracker } from "@/hooks/useNativeStepTracker";
import { api, errorMessage } from "@/lib/client/api";
import { MAX_DAILY_STEPS } from "@/lib/validation/steps";

function compactGoal(goal: number): string {
  return goal >= 1000 && goal % 1000 === 0 ? `${goal / 1000}k` : goal.toLocaleString();
}

export interface StepsCellProps {
  storedSteps: number;
  goal: number | null;
  todayStr: string;
  timeZone: string;
}

/**
 * Steps in the Today ledger. In the Android app the phone's pedometer counts
 * and a tap refreshes it; on the web a tap opens a sheet to enter the day's total.
 */
export function StepsCell({ storedSteps, goal, todayStr, timeZone }: StepsCellProps) {
  const router = useRouter();
  const { toast } = useToast();
  const liveToday = useLiveToday(todayStr, timeZone);
  const { isNative, steps: liveSteps, isSyncing, syncNow } = useNativeStepTracker(storedSteps);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(storedSteps || null);
  const [isSaving, setIsSaving] = useState(false);

  // Live pedometer steps belong to the device's current day; never mix them into yesterday's numbers.
  const steps = liveToday !== todayStr ? storedSteps : Math.max(storedSteps, liveSteps);
  const hasGoal = goal !== null && goal > 0;
  const value = <LedgerValue value={steps.toLocaleString()} goal={hasGoal ? compactGoal(goal) : undefined} />;

  const save = async () => {
    if (draft === null) return;
    setIsSaving(true);
    try {
      await api("/api/steps/sync", { method: "POST", body: { steps: Math.round(draft), source: "manual" } });
      setIsSheetOpen(false);
      toast("Steps saved", "success");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-[5px] px-3 py-2.5">
      <LedgerLabel>Steps</LedgerLabel>
      <button
        type="button"
        onClick={() => {
          if (isNative) {
            syncNow();
            return;
          }
          setDraft(storedSteps || null);
          setIsSheetOpen(true);
        }}
        disabled={isNative && isSyncing}
        aria-label={
          isNative
            ? `Steps ${steps.toLocaleString()}${hasGoal ? ` of ${goal.toLocaleString()}` : ""}. Refresh from the pedometer`
            : `Steps ${steps.toLocaleString()}${hasGoal ? ` of ${goal.toLocaleString()}` : ""}. Enter today's steps`
        }
        className="-my-1 -ms-1 inline-flex items-center gap-1.5 self-start rounded-chip px-1 py-1 text-start transition-colors hover:bg-elevated cursor-pointer disabled:cursor-wait"
      >
        {value}
        {isNative && isSyncing && <RefreshCw className="h-3 w-3 animate-spin text-ink-3" aria-hidden="true" />}
      </button>
      {hasGoal && <ProgressTrack value={steps} max={goal} size="sm" />}

      {!isNative && (
        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Steps today"
          description="Enter today's total from your watch or phone. It replaces the number stored for today."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsSheetOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} isLoading={isSaving} disabled={draft === null}>
                Save
              </Button>
            </>
          }
        >
          <NumberField
            label="Steps today"
            value={draft}
            onChange={setDraft}
            min={0}
            max={MAX_DAILY_STEPS}
            step={500}
          />
        </Sheet>
      )}
    </div>
  );
}

export default StepsCell;
