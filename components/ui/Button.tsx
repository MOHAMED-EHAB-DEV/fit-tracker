"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button-styles";

export type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
export { buttonClasses } from "@/components/ui/button-styles";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** sm 36px (inside rows), md 44px, lg 48px (the screen's primary action). */
  size?: ButtonSize;
  isLoading?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      startContent,
      endContent,
      fullWidth = false,
      disabled,
      className,
      // A button only submits a form when it says so (the browser default is "submit").
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClasses({ variant, size, fullWidth, className })}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          startContent && (
            <span className="flex shrink-0" aria-hidden="true">
              {startContent}
            </span>
          )
        )}
        <span>{children}</span>
        {!isLoading && endContent && (
          <span className="flex shrink-0" aria-hidden="true">
            {endContent}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
