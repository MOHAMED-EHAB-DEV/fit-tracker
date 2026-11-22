"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface LedgerInputProps {
  id: string;
  /** Accessible name ("Set 2 weight in kg"). */
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Last time's (or the target) value, shown as a ghost and logged if the box stays empty. */
  ghost?: number | null;
  decimals: number;
  max: number;
  /** Which look the row gives it. */
  tone: "done" | "active" | "open";
  /** Briefly highlights the box that still needs a value. */
  highlight?: boolean;
  /** Next field / log on Enter. */
  onEnter: () => void;
  onFocusChange: (focused: boolean) => void;
  disabled?: boolean;
  /** Marks the box as a routine target (the editor moves through these on Enter). */
  dataTargetBox?: boolean;
}

function format(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
}

function parse(text: string): number | null {
  const normalized = text.replace(",", ".").trim();
  if (normalized === "" || normalized === ".") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A value box in the set ledger: numeric keypad, everything selected on
 * focus, free typing while focused (the text is interpreted, not snapped),
 * Enter moves on. A value changed from outside (the keypad bar's steppers)
 * replaces the text being typed.
 */
export function LedgerInput({
  id,
  label,
  value,
  onChange,
  ghost,
  decimals,
  max,
  tone,
  highlight = false,
  onEnter,
  onFocusChange,
  disabled = false,
  dataTargetBox = false,
}: LedgerInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (draft !== null && parse(draft) !== value) setDraft(format(value, decimals));
  }
  const shown = draft !== null ? draft : format(value, decimals);

  return (
    <input
      id={id}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      enterKeyHint="next"
      aria-label={label}
      data-target-box={dataTargetBox ? "" : undefined}
      disabled={disabled}
      value={shown}
      placeholder={ghost == null ? undefined : format(ghost, decimals)}
      onFocus={(event) => {
        setDraft(format(value, decimals));
        event.currentTarget.select();
        onFocusChange(true);
      }}
      onBlur={() => {
        setDraft(null);
        onFocusChange(false);
      }}
      onChange={(event) => {
        const text = event.target.value;
        const pattern = decimals > 0 ? /^\d*[.,]?\d*$/ : /^\d*$/;
        if (!pattern.test(text)) return;
        setDraft(text);
        const parsed = parse(text);
        if (parsed === null) onChange(null);
        else if (parsed <= max) onChange(Math.round(parsed * 10 ** decimals) / 10 ** decimals);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      className={cn(
        "h-11 w-full min-w-0 rounded-control border text-center font-mono text-base font-medium tabular-nums outline-none transition-colors placeholder:font-normal placeholder:text-ink-3 focus:border-accent disabled:opacity-60",
        tone === "done" && "border-transparent bg-transparent text-ink-2",
        tone === "active" && "border-line-strong bg-elevated text-ink",
        tone === "open" && "border-line bg-surface text-ink",
        highlight && "border-warn"
      )}
    />
  );
}

export default LedgerInput;
