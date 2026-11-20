"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";
import {
  FIELD_BOX,
  FIELD_BOX_DISABLED,
  FIELD_BOX_INVALID,
  FIELD_DESCRIPTION,
  FIELD_ERROR,
  FIELD_LABEL,
  FIELD_SIZE,
  type FieldSize,
} from "@/components/ui/field-styles";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  /** Decorative content before the text (an icon). Hidden from screen readers. */
  startContent?: React.ReactNode;
  /** Content after the text: a unit, or an interactive button such as "show password". */
  endContent?: React.ReactNode;
  size?: FieldSize;
  /** Classes for the field box. */
  className?: string;
  /** Classes for the outer wrapper (label + box + messages). */
  containerClassName?: string;
  /** Classes for the <input> element itself. */
  inputClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      description,
      errorMessage,
      isInvalid = false,
      startContent,
      endContent,
      size = "md",
      disabled,
      className,
      containerClassName,
      inputClassName,
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
    const showError = isInvalid && Boolean(errorMessage);

    const describedBy =
      [showError ? errorId : null, description && !showError ? descId : null, ariaDescribedBy]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("w-full space-y-1.5 text-start", containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={FIELD_LABEL}>
            {label}
          </label>
        )}

        <div
          className={cn(
            "relative flex items-center gap-2 px-3.5",
            FIELD_BOX,
            FIELD_SIZE[size],
            isInvalid && FIELD_BOX_INVALID,
            disabled && FIELD_BOX_DISABLED,
            className
          )}
        >
          {startContent && (
            <span className="flex shrink-0 text-zinc-400 select-none" aria-hidden="true">
              {startContent}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full min-w-0 self-stretch bg-transparent text-white placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed scheme-dark [&::-webkit-search-cancel-button]:appearance-none",
              inputClassName
            )}
            {...props}
          />

          {endContent && <span className="flex shrink-0 items-center text-zinc-400 -me-1.5">{endContent}</span>}
        </div>

        {showError && (
          <p id={errorId} role="alert" className={FIELD_ERROR}>
            {errorMessage}
          </p>
        )}

        {description && !showError && (
          <p id={descId} className={FIELD_DESCRIPTION}>
            {description}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
