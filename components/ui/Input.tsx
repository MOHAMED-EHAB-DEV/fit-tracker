"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  variant?: "flat" | "bordered" | "underlined" | "faded";
  radius?: "none" | "sm" | "md" | "lg" | "full";
}

const VARIANT_MAP = {
  flat: "bg-zinc-900/70 hover:bg-zinc-900/90 border border-transparent focus-within:border-emerald-500/50 focus-within:bg-zinc-900 focus-within:ring-2 focus-within:ring-emerald-500/25",
  bordered: "bg-zinc-950/60 border border-white/10 hover:border-white/20 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25",
  faded: "bg-zinc-900/40 border border-white/8 hover:border-white/15 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25",
  underlined: "bg-transparent border-b-2 border-white/10 rounded-none px-0 focus-within:border-emerald-500",
};

const RADIUS_MAP = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      errorMessage,
      isInvalid = false,
      startContent,
      endContent,
      variant = "bordered",
      radius = "lg",
      disabled,
      className,
      id,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const descId = `${inputId}-desc`;

    const computedDescribedBy = [
      isInvalid && errorMessage ? errorId : null,
      description ? descId : null,
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none"
          >
            {label}
          </label>
        )}

        <div
          className={cn(
            "relative flex items-center gap-2.5 px-4 py-3 min-h-[44px] text-sm transition-all duration-200 backdrop-blur-md",
            VARIANT_MAP[variant],
            RADIUS_MAP[radius],
            isInvalid && "border-red-500/80 ring-2 ring-red-500/20 bg-red-500/5",
            disabled && "opacity-40 cursor-not-allowed pointer-events-none",
            className
          )}
        >
          {startContent && <span className="text-zinc-500 shrink-0 select-none" aria-hidden="true">{startContent}</span>}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={isInvalid}
            aria-describedby={computedDescribedBy}
            className="w-full bg-transparent text-white placeholder-zinc-500 text-sm font-medium focus:outline-none disabled:cursor-not-allowed"
            {...props}
          />

          {endContent && <span className="text-zinc-500 shrink-0 select-none" aria-hidden="true">{endContent}</span>}
        </div>

        {errorMessage && isInvalid && (
          <p id={errorId} role="alert" className="text-xs font-semibold text-red-400 mt-1">
            {errorMessage}
          </p>
        )}

        {description && !isInvalid && (
          <p id={descId} className="text-xs text-zinc-500 mt-1">
            {description}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
