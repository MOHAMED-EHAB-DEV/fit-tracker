"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { LedgerLabel, LedgerValue } from "@/components/dashboard/FuelLedger";
import { logWaterAction } from "@/lib/nutrition/actions";
import { cn } from "@/lib/utils";

const QUICK_ADD_ML = 250;

function litres(ml: number): string {
  return (Math.max(0, ml) / 1000).toFixed(1);
}

export interface WaterCellProps {
  initialWaterMl: number;
  goalMl: number | null;
  /** Water can only be added to today. Other days show the amount only. */
  editable?: boolean;
  /** "strip" spans the ledger (Eat); "cell" sits beside steps (Today). */
  layout?: "cell" | "strip";
}

/**
 * Water in the ledger: "+250 ml" adds at once with an Undo toast; tapping the
 * amount opens a sheet for any other amount (or a correction).
 */
export function WaterCell({ initialWaterMl, goalMl, editable = true, layout = "cell" }: WaterCellProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [serverWater, setServerWater] = useState(initialWaterMl);
  const [seenProp, setSeenProp] = useState(initialWaterMl);
  const [pendingDelta, setPendingDelta] = useState(0);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(330);
  const [isSaving, setIsSaving] = useState(false);
  const busyRef = useRef(false);

  // Fresh server data (router.refresh, navigation) replaces the local copy.
  if (initialWaterMl !== seenProp) {
    setSeenProp(initialWaterMl);
    setServerWater(initialWaterMl);
  }

  const shown = Math.max(0, serverWater + pendingDelta);
  const hasGoal = goalMl !== null && goalMl > 0;

  /** Adds (or with a negative amount removes) water; returns the day it went to, or null. */
  const change = async (delta: number, undoDay?: string): Promise<string | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setPendingDelta(delta);
    try {
      const result = await logWaterAction(delta, undoDay);
      if (!result.success || typeof result.waterMl !== "number") {
        throw new Error(result.error || "Water could not be saved.");
      }
      setServerWater(result.waterMl);
      router.refresh();
      return result.dateString ?? null;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Water could not be saved. Please try again.", "error");
      return null;
    } finally {
      setPendingDelta(0);
      busyRef.current = false;
    }
  };

  const quickAdd = async () => {
    const day = await change(QUICK_ADD_ML);
    if (!day) return;
    toast(`Added ${QUICK_ADD_ML} ml of water`, "success", {
      action: { label: "Undo", onClick: () => void change(-QUICK_ADD_ML, day) },
    });
  };

  const saveCustom = async (direction: 1 | -1) => {
    if (!amount || amount <= 0) return;
    setIsSaving(true);
    const day = await change(direction * amount);
    setIsSaving(false);
    if (!day) return;
    setIsSheetOpen(false);
    toast(direction > 0 ? `Added ${amount} ml of water` : `Removed ${amount} ml of water`, "success");
  };

  const value = (
    <LedgerValue value={litres(shown)} goal={hasGoal ? litres(goalMl) : undefined} unit="L" />
  );

  return (
    <div className={cn("flex items-center justify-between gap-2", layout === "strip" ? "px-3 py-2.5" : "px-3 py-2.5")}>
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <LedgerLabel>Water</LedgerLabel>
        {editable ? (
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            aria-label={`Water ${litres(shown)} litres${hasGoal ? ` of ${litres(goalMl)}` : ""}. Change`}
            className="-my-1 -ms-1 self-start rounded-chip px-1 py-1 text-start transition-colors hover:bg-elevated cursor-pointer"
          >
            {value}
          </button>
        ) : (
          value
        )}
        {hasGoal && <ProgressTrack value={shown} max={goalMl} size="sm" />}
      </div>

      {editable && (
        <button
          type="button"
          onClick={() => void quickAdd()}
          aria-label={`Add ${QUICK_ADD_ML} millilitres of water`}
          className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-control border border-line-strong bg-elevated px-2.5 font-mono text-xs font-medium text-ink transition-colors hover:border-ink-3 active:scale-[0.97] cursor-pointer"
        >
          +{QUICK_ADD_ML} ml
        </button>
      )}

      {editable && (
        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Water today"
          description={`${shown.toLocaleString()} ml so far${hasGoal ? ` of ${goalMl.toLocaleString()} ml` : ""}.`}
          size="sm"
          footer={
            <>
              <Button variant="secondary" disabled={isSaving || !amount} onClick={() => void saveCustom(-1)}>
                Remove
              </Button>
              <Button disabled={isSaving || !amount} isLoading={isSaving} onClick={() => void saveCustom(1)}>
                Add
              </Button>
            </>
          }
        >
          <label className="mb-1.5 block text-[13px] font-medium text-ink-2" htmlFor="water-amount">
            Amount
          </label>
          <NumberField
            id="water-amount"
            label="Water amount in millilitres"
            value={amount}
            onChange={setAmount}
            min={1}
            max={5000}
            step={50}
            suffix="ml"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {[150, 330, 500, 750].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                aria-pressed={amount === preset}
                className={cn(
                  "inline-flex h-9 items-center rounded-chip border px-3 font-mono text-[13px] transition-colors cursor-pointer",
                  amount === preset ? "border-ink bg-ink text-ink-inverse" : "border-line bg-elevated text-ink hover:border-line-strong"
                )}
              >
                {preset} ml
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

export default WaterCell;
