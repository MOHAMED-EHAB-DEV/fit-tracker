"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Plus, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { logWaterAction } from "@/lib/nutrition/actions";
import { formatAmount } from "@/lib/nutrition/totals";

interface WaterCounterProps {
  initialWaterMl: number;
}

const QUICK_AMOUNTS = [250, 500] as const;

export function WaterCounter({ initialWaterMl }: WaterCounterProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [serverWater, setServerWater] = useState(initialWaterMl);
  const [seenProp, setSeenProp] = useState(initialWaterMl);
  const [pendingDelta, setPendingDelta] = useState(0);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  // The day the last tap went to, so its undo takes the water off that day.
  const [lastAddedDay, setLastAddedDay] = useState<string | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const busyRef = useRef(false);

  // Fresh server data (router.refresh, navigation) replaces the local copy.
  if (initialWaterMl !== seenProp) {
    setSeenProp(initialWaterMl);
    setServerWater(initialWaterMl);
  }

  const shown = Math.max(0, serverWater + pendingDelta);

  const change = async (amount: number, isUndo: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsPending(true);
    setPendingDelta(amount);
    try {
      const result = await logWaterAction(amount, isUndo ? lastAddedDay : undefined);
      if (!result.success || typeof result.waterMl !== "number") {
        throw new Error(result.error || "Water could not be saved.");
      }
      setServerWater(result.waterMl);
      setLastAdded(isUndo ? null : amount);
      setLastAddedDay(isUndo ? undefined : result.dateString);
      if (isUndo) toast(`Removed ${amount * -1} ml`, "info");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Water could not be saved. Please try again.", "error");
    } finally {
      setPendingDelta(0);
      busyRef.current = false;
      setIsPending(false);
    }
  };

  return (
    <section
      aria-label="Water"
      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
          <Droplets className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-white">Water today</h3>
          <p className="text-sm text-zinc-400" aria-live="polite">
            <strong className="text-cyan-300 tabular-nums">{formatAmount(shown)} ml</strong>
            {lastAdded !== null && !isPending && <span className="ms-1">(added {lastAdded} ml)</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => change(ml, false)}
            disabled={isPending}
            aria-label={`Add ${ml} millilitres of water`}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 min-h-11 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-sm font-semibold border border-cyan-500/30 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{ml} ml</span>
          </button>
        ))}
        {lastAdded !== null && (
          <button
            type="button"
            onClick={() => change(-lastAdded, true)}
            disabled={isPending}
            aria-label={`Undo adding ${lastAdded} millilitres`}
            className="flex items-center justify-center gap-1.5 px-3.5 min-h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-semibold border border-zinc-700 transition disabled:opacity-50 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />
            <span>Undo</span>
          </button>
        )}
      </div>
    </section>
  );
}

export default WaterCounter;
