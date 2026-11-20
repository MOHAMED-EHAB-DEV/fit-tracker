"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckSquare, Droplets, Dumbbell, Scale, UtensilsCrossed } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { logWaterAction } from "@/lib/nutrition/actions";

const ROW =
  "flex items-center gap-3 px-3 min-h-14 rounded-2xl bg-surface-2/60 active:bg-surface-2 text-base font-medium text-white";

const WATER_AMOUNTS = [250, 500];

/** The things people log many times a day, one tap away from anywhere. */
export function QuickActionsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingWater, setPendingWater] = useState<number | null>(null);

  const addWater = async (amount: number) => {
    if (pendingWater !== null) return;
    setPendingWater(amount);
    try {
      const result = await logWaterAction(amount);
      if (!result.success) {
        toast(result.error || "Could not log water. Try again.", "error");
        return;
      }
      toast(`Added ${amount} ml of water`, "success");
      router.refresh();
      onClose();
    } catch {
      toast("Could not log water. Check your connection and try again.", "error");
    } finally {
      setPendingWater(null);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Quick add" position="bottom">
      <div className="space-y-2">
        <Link href="/workouts" onClick={onClose} className={ROW}>
          <Dumbbell className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Start a workout</span>
        </Link>
        <Link href="/nutrition/analyze" onClick={onClose} className={ROW}>
          <Camera className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Log a meal from a photo</span>
        </Link>
        <Link href="/nutrition" onClick={onClose} className={ROW}>
          <UtensilsCrossed className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Add a meal</span>
        </Link>

        <div className="flex items-center gap-3 px-3 min-h-14 rounded-2xl bg-surface-2/60">
          <Droplets className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="text-base font-medium text-white flex-1">Water</span>
          {WATER_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={pendingWater !== null}
              onClick={() => addWater(amount)}
              className="px-4 min-h-11 rounded-xl bg-sky-500/15 text-sky-300 text-sm font-semibold active:bg-sky-500/25 disabled:opacity-60 cursor-pointer"
            >
              {pendingWater === amount ? "Adding…" : `+${amount} ml`}
            </button>
          ))}
        </div>

        <Link href="/body-comp" onClick={onClose} className={ROW}>
          <Scale className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Log weight</span>
        </Link>
        <Link href="/habits" onClick={onClose} className={ROW}>
          <CheckSquare className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <span>Check off a habit</span>
        </Link>
      </div>
    </Drawer>
  );
}

export default QuickActionsSheet;
