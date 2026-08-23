"use client";

import React from "react";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";

interface WeightUnitToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export function WeightUnitToggle({ className, size = "md" }: WeightUnitToggleProps) {
  const { weightUnit, setWeightUnit } = useUser();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setWeightUnit("lbs");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setWeightUnit("kg");
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Select weight measurement unit"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center p-1 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-inner select-none",
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={weightUnit === "kg"}
        tabIndex={weightUnit === "kg" ? 0 : -1}
        onClick={() => setWeightUnit("kg")}
        className={cn(
          "rounded-xl font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          size === "sm" ? "px-3 py-1 min-h-[32px] text-[10px]" : "px-3.5 py-1.5 min-h-[36px] text-xs",
          weightUnit === "kg"
            ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
        )}
      >
        KG
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={weightUnit === "lbs"}
        tabIndex={weightUnit === "lbs" ? 0 : -1}
        onClick={() => setWeightUnit("lbs")}
        className={cn(
          "rounded-xl font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
          size === "sm" ? "px-3 py-1 min-h-[32px] text-[10px]" : "px-3.5 py-1.5 min-h-[36px] text-xs",
          weightUnit === "lbs"
            ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
        )}
      >
        LBS
      </button>
    </div>
  );
}

export default WeightUnitToggle;
