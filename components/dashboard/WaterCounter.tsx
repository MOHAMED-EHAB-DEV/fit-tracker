"use client";

import React, { useState } from "react";
import { Droplets, Plus } from "lucide-react";

interface WaterCounterProps {
  initialWaterMl: number;
}

export function WaterCounter({ initialWaterMl }: WaterCounterProps) {
  const [waterMl, setWaterMl] = useState(initialWaterMl);
  const [isUpdating, setIsUpdating] = useState(false);

  const addWater = async (amount: number) => {
    setIsUpdating(true);
    const newAmount = waterMl + amount;
    setWaterMl(newAmount); // optimistic update

    try {
      await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Add ${amount}ml water`,
          mode: "multi_log",
        }),
      });
    } catch (err) {
      console.error("Failed to log water:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
          <Droplets className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-white">Quick Water Logger</h3>
          <p className="text-xs text-zinc-400">Current total: <strong className="text-cyan-300">{waterMl} ml</strong></p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={() => addWater(250)}
          disabled={isUpdating}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-700/60 transition active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span>+250 ml</span>
        </button>

        <button
          onClick={() => addWater(500)}
          disabled={isUpdating}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition active:scale-95 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span>+500 ml</span>
        </button>
      </div>
    </div>
  );
}

export default WaterCounter;
