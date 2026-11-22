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
} from "@/components/ui/field-styles";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isInvalid?: boolean;
  /** Classes for the <textarea> box. */
  className?: string;
  /** Classes for the outer wrapper (label + box + messages). */
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      description,
      errorMessage,
      isInvalid = false,
      disabled,
      className,
      containerClassName,
      id,
      rows = 3,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const descId = `${textareaId}-desc`;
    const showError = isInvalid && Boolean(errorMessage);

    const describedBy =
      [showError ? errorId : null, description && !showError ? descId : null, ariaDescribedBy]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className={cn("w-full space-y-1.5 text-start", containerClassName)}>
        {label && (
          <label htmlFor={textareaId} className={FIELD_LABEL}>
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "block w-full px-3.5 py-3 text-base placeholder:text-ink-3 focus:outline-none resize-y",
            FIELD_BOX,
            isInvalid && FIELD_BOX_INVALID,
            disabled && FIELD_BOX_DISABLED,
            className
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";

export default Textarea;
