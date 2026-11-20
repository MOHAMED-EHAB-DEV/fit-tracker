"use client";

import React, { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  /** Visible label next to the box. Without one, pass aria-label. */
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Classes for the outer <label>. */
  className?: string;
}

/** A checkbox with a large tap area; the native input stays in place for keyboard and screen readers. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const descId = description ? `${inputId}-desc` : undefined;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-3 min-h-11 py-2.5 text-start cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className="relative grid place-items-center w-5 h-5 shrink-0 mt-0.5">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            aria-describedby={descId}
            className="peer absolute inset-0 m-0 appearance-none rounded-md border border-zinc-500 bg-transparent cursor-pointer transition-colors checked:bg-emerald-500 checked:border-emerald-500 disabled:cursor-not-allowed"
            {...props}
          />
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="pointer-events-none relative w-3.5 h-3.5 text-zinc-950 opacity-0 peer-checked:opacity-100"
          />
        </span>
        {(label || description) && (
          <span className="min-w-0">
            {label && <span className="block text-sm text-zinc-200">{label}</span>}
            {description && (
              <span id={descId} className="block text-xs text-zinc-400 mt-0.5">
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
