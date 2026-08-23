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

  return (
    <div
      role="group"
      aria-label="Select weight measurement unit"
      className={cn(
        "inline-flex items-center p-1 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-inner select-none",
        className
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={weightUnit === "kg"}
        onClick={() => setWeightUnit("kg")}
        className={cn(
          "rounded-xl font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center",
          size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-xs",
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
        onClick={() => setWeightUnit("lbs")}
        className={cn(
          "rounded-xl font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center",
          size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-1.5 text-xs",
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
