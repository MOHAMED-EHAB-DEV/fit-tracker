"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const GROUP = "grid auto-cols-fr grid-flow-col gap-0.5 rounded-control border border-line bg-surface p-[3px]";
const OPTION =
  "flex min-h-8 items-center justify-center rounded-chip border border-transparent px-3 text-[13px] leading-tight transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";
const OPTION_SELECTED = "border-line bg-elevated font-semibold text-ink";
const OPTION_IDLE = "font-medium text-ink-2 hover:text-ink";

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
 * A small either/or choice (kg / lbs, 30d / 90d, System / Light / Dark).
 * Behaves like a radio group: one tab stop, arrow keys move the selection.
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
    <div role="radiogroup" aria-label={label} className={cn("inline-grid", GROUP, className)}>
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
            className={cn(OPTION, selected ? OPTION_SELECTED : OPTION_IDLE)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentedNavProps {
  /** Accessible name, e.g. "Train sections". */
  label: string;
  items: ReadonlyArray<{ href: string; label: string; active: boolean }>;
  className?: string;
}

/**
 * The same control for sections that are separate pages (Workouts | History,
 * Schedule | Habits): each segment is a link, the current one is marked.
 */
export function SegmentedNav({ label, items, className }: SegmentedNavProps) {
  return (
    <nav aria-label={label} className={cn("grid", GROUP, className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(OPTION, item.active ? OPTION_SELECTED : OPTION_IDLE)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default SegmentedControl;
