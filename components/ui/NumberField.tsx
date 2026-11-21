"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface NumberFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Accessible name; every field needs one. */
  label: string;
  placeholder?: string;
  /** Decimal places allowed (0 = whole numbers). */
  decimals?: number;
  min?: number;
  max?: number;
  /** Shown inside the field on the trailing edge, e.g. "kg". */
  suffix?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
}

function format(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
}

/**
 * A numeric text field built for thumbs: it opens the number keypad, lets the
 * user clear it and type freely (the text is only interpreted, never snapped
 * back, while typing), and clamps to min/max when focus leaves.
 */
export function NumberField({
  value,
  onChange,
  label,
  placeholder,
  decimals = 0,
  min = 0,
  max = 100_000,
  suffix,
  disabled,
  className,
  inputClassName,
  id,
}: NumberFieldProps) {
  // While focused the user's own text is shown, so "12." or "" stay as typed.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : format(value, decimals);

  const parse = (text: string): number | null => {
    const normalized = text.replace(",", ".").trim();
    if (normalized === "" || normalized === "." || normalized === "-") return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    const pattern = decimals > 0 ? /^\d*[.,]?\d*$/ : /^\d*$/;
    if (!pattern.test(text)) return;
    setDraft(text);
    const parsed = parse(text);
    if (parsed === null) onChange(null);
    else if (parsed <= max) onChange(parsed);
  };

  const handleBlur = () => {
    const parsed = draft !== null ? parse(draft) : value;
    if (parsed !== null) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const rounded = Math.round(clamped * 10 ** decimals) / 10 ** decimals;
      if (rounded !== value) onChange(rounded);
    }
    setDraft(null);
  };

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        enterKeyHint="done"
        aria-label={label}
        disabled={disabled}
        value={shown}
        placeholder={placeholder}
        onFocus={(event) => {
          setDraft(format(value, decimals));
          event.target.select();
        }}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        className={cn(
          "w-full min-h-12 rounded-xl bg-surface-2 border border-line text-center text-base font-semibold text-white tabular-nums placeholder:text-zinc-500 placeholder:font-normal transition-colors hover:not-focus:border-white/20 focus:outline-none focus:border-emerald-500/80 disabled:opacity-60",
          suffix ? "ps-2 pe-9" : "px-2",
          inputClassName
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs font-medium text-zinc-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

export default NumberField;
