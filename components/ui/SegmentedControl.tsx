"use client";

import React, { useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group, e.g. "Weight unit". */
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A small either/or choice (kg / lbs, cm / in). Behaves like a radio group:
 * one tab stop, arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  // With nothing chosen yet, the first option is the tab stop.
  const hasSelection = options.some((option) => option.value === value);

  const move = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-xl border border-line bg-surface-2 p-1", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!hasSelection && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold leading-tight transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
              selected ? "bg-emerald-500 text-zinc-950" : "text-zinc-300 hover:text-white"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
