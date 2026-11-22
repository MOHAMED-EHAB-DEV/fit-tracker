"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TickProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Creatine 5 g done". */
  label: string;
  disabled?: boolean;
  /** sm 26px (inside dense rows), md 28px. Both have a 44px touch area. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * The one "done" control (habits, checklist rows). Done is solid ink with an
 * inverse check, never a green fill; open is a hairline square.
 */
export function Tick({ checked, onChange, label, disabled = false, size = "md", className }: TickProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-chip border-[1.5px] cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        size === "md" ? "h-7 w-7" : "h-[26px] w-[26px]",
        checked ? "border-ink bg-ink text-ink-inverse" : "border-line-strong bg-transparent text-transparent hover:border-ink-3",
        className
      )}
    >
      <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

export default Tick;
