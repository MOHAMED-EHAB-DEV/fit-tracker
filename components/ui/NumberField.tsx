"use client";

import React, { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
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
  /** Adds − / + buttons that change the value by this amount (2.5 for weight, 1 for reps). */
  step?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  /** Marks the field as wrong (danger border, aria-invalid). */
  isInvalid?: boolean;
  /** Shown under the field and read with it. */
  errorMessage?: React.ReactNode;
  /** Id of a message shown elsewhere that describes this field (one message for two fields). */
  describedBy?: string;
}

function format(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
}

/**
 * A numeric text field built for thumbs: it opens the number keypad, lets the
 * user clear it and type freely (the text is only interpreted, never snapped
 * back, while typing), and clamps to min/max when focus leaves. With `step`,
 * − / + buttons sit on either side.
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
  step,
  disabled,
  className,
  inputClassName,
  id,
  isInvalid = false,
  errorMessage,
  describedBy,
}: NumberFieldProps) {
  const errorId = useId();
  const showError = Boolean(errorMessage);
  // While focused the user's own text is shown, so "12." or "" stay as typed.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft !== null ? draft : format(value, decimals);

  const parse = (text: string): number | null => {
    const normalized = text.replace(",", ".").trim();
    if (normalized === "" || normalized === "." || normalized === "-") return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const clampRound = (next: number): number => {
    const clamped = Math.min(max, Math.max(min, next));
    return Math.round(clamped * 10 ** decimals) / 10 ** decimals;
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
      const rounded = clampRound(parsed);
      if (rounded !== value) onChange(rounded);
    }
    setDraft(null);
  };

  const nudge = (direction: 1 | -1) => {
    if (!step) return;
    const base = draft !== null ? (parse(draft) ?? value ?? 0) : (value ?? 0);
    setDraft(null);
    onChange(clampRound(base + direction * step));
  };

  const stepperClass =
    "relative grid h-12 w-11 shrink-0 place-items-center rounded-control border border-line bg-elevated text-ink-2 transition-colors hover:border-line-strong hover:text-ink active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const input = (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        enterKeyHint="done"
        aria-label={label}
        aria-invalid={isInvalid || showError || undefined}
        aria-describedby={showError ? errorId : describedBy}
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
          "w-full min-h-12 rounded-control border border-line bg-elevated text-center font-mono text-base font-medium tabular-nums text-ink placeholder:font-normal placeholder:text-ink-3 transition-colors hover:not-focus:border-line-strong focus:border-accent focus:outline-none disabled:opacity-60",
          suffix ? "ps-2 pe-9" : "px-2",
          (isInvalid || showError) && "border-danger hover:not-focus:border-danger focus:border-danger",
          inputClassName
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs font-medium text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  );

  const error = showError ? (
    <p id={errorId} className="mt-1.5 text-xs text-danger">
      {errorMessage}
    </p>
  ) : null;

  if (!step) {
    return (
      <div className={cn("relative", className)}>
        {input}
        {error}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={stepperClass}
          disabled={disabled || (value !== null && value <= min)}
          onClick={() => nudge(-1)}
          aria-label={`${label}: minus ${step}`}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        {input}
        <button
          type="button"
          className={stepperClass}
          disabled={disabled || (value !== null && value >= max)}
          onClick={() => nudge(1)}
          aria-label={`${label}: plus ${step}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error}
    </div>
  );
}

export default NumberField;
