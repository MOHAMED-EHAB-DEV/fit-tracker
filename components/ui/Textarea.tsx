"use client";

import React, { useId, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  variant?: "flat" | "bordered" | "underlined" | "faded";
  radius?: "none" | "sm" | "md" | "lg" | "full";
  size?: "sm" | "md" | "lg";
  minRows?: number;
  maxRows?: number;
  disableAutosize?: boolean;
  classNames?: {
    base?: string;
    label?: string;
    inputWrapper?: string;
    input?: string;
    description?: string;
    errorMessage?: string;
  };
}

const VARIANT_MAP = {
  flat: "bg-zinc-900/70 hover:bg-zinc-900/90 border border-transparent focus-within:border-emerald-500/50 focus-within:bg-zinc-900 focus-within:ring-2 focus-within:ring-emerald-500/25",
  bordered:
    "bg-zinc-950/60 border border-white/10 hover:border-white/20 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25",
  faded: "bg-zinc-900/40 border border-white/8 hover:border-white/15 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25",
  underlined:
    "bg-transparent border-b-2 border-white/10 rounded-none px-0 focus-within:border-emerald-500",
};

const RADIUS_MAP = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-3xl",
};

const SIZE_MAP = {
  sm: "text-xs px-3 py-2 min-h-[72px]",
  md: "text-sm px-4 py-3 min-h-[96px]",
  lg: "text-base px-5 py-3.5 min-h-[120px]",
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      errorMessage,
      isInvalid = false,
      isRequired = false,
      isDisabled,
      isReadOnly,
      startContent,
      endContent,
      variant = "bordered",
      radius = "lg",
      size = "md",
      minRows = 3,
      maxRows,
      rows,
      disableAutosize = false,
      disabled,
      readOnly,
      className,
      classNames,
      id,
      "aria-describedby": ariaDescribedBy,
      onInput,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const descId = `${textareaId}-desc`;

    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    const isInputDisabled = disabled || isDisabled;
    const isInputReadOnly = readOnly || isReadOnly;

    const adjustHeight = useCallback(() => {
      if (disableAutosize) return;
      const el = internalRef.current;
      if (!el) return;

      el.style.height = "auto";
      const scrollHeight = el.scrollHeight;

      if (maxRows) {
        const computedLineHeight = parseInt(
          window.getComputedStyle(el).lineHeight || "20",
          10
        );
        const maxHeight = computedLineHeight * maxRows;
        if (scrollHeight > maxHeight) {
          el.style.height = `${maxHeight}px`;
          el.style.overflowY = "auto";
          return;
        }
      }

      el.style.overflowY = "hidden";
      el.style.height = `${scrollHeight}px`;
    }, [disableAutosize, maxRows]);

    useEffect(() => {
      adjustHeight();
    }, [props.value, props.defaultValue, adjustHeight]);

    const handleRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
            node;
        }
      },
      [ref]
    );

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      onInput?.(e as any);
    };

    const computedDescribedBy =
      [
        isInvalid && errorMessage ? errorId : null,
        description ? descId : null,
        ariaDescribedBy,
      ]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("w-full space-y-1.5 text-start", classNames?.base)}>
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              "block text-xs font-bold uppercase tracking-wider text-zinc-400 select-none",
              classNames?.label
            )}
          >
            {label}
            {isRequired && <span className="text-red-400 ms-1">*</span>}
          </label>
        )}

        <div
          className={cn(
            "relative flex items-start gap-2.5 transition-all duration-200 backdrop-blur-md",
            VARIANT_MAP[variant],
            RADIUS_MAP[radius],
            SIZE_MAP[size],
            isInvalid &&
              "border-red-500/80 ring-2 ring-red-500/20 bg-red-500/5",
            isInputDisabled &&
              "opacity-40 cursor-not-allowed pointer-events-none",
            className,
            classNames?.inputWrapper
          )}
        >
          {startContent && (
            <span
              className="text-zinc-500 shrink-0 pt-0.5 select-none"
              aria-hidden="true"
            >
              {startContent}
            </span>
          )}

          <textarea
            ref={handleRef}
            id={textareaId}
            disabled={isInputDisabled}
            readOnly={isInputReadOnly}
            aria-invalid={isInvalid}
            aria-describedby={computedDescribedBy}
            rows={rows || minRows}
            onInput={handleInput}
            className={cn(
              "w-full bg-transparent text-white placeholder-zinc-500 text-sm font-medium focus:outline-none disabled:cursor-not-allowed resize-none leading-relaxed",
              classNames?.input
            )}
            {...props}
          />

          {endContent && (
            <span
              className="text-zinc-500 shrink-0 pt-0.5 select-none"
              aria-hidden="true"
            >
              {endContent}
            </span>
          )}
        </div>

        {errorMessage && isInvalid && (
          <p
            id={errorId}
            role="alert"
            className={cn(
              "text-xs font-semibold text-red-400 mt-1",
              classNames?.errorMessage
            )}
          >
            {errorMessage}
          </p>
        )}

        {description && !isInvalid && (
          <p
            id={descId}
            className={cn(
              "text-xs text-zinc-500 mt-1",
              classNames?.description
            )}
          >
            {description}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
