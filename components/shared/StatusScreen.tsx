import React from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

interface StatusScreenProps {
  title: string;
  message: string;
  /** Short reference shown for support (an error digest). */
  reference?: string;
  /** Rendered as the primary action; pass a button or a link. */
  primaryAction?: React.ReactNode;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Fill the whole screen (outside the signed-in shell). */
  fullScreen?: boolean;
  /** Announce to assistive technology as an error. */
  isError?: boolean;
}

export const STATUS_PRIMARY_CLASS = buttonClasses({ variant: "primary", size: "lg", className: "w-full px-6 sm:w-auto" });

/**
 * One plain screen for "something went wrong" and "not found": what happened
 * in the user's words, and what they can do next.
 */
export function StatusScreen({
  title,
  message,
  reference,
  primaryAction,
  secondaryHref,
  secondaryLabel,
  fullScreen = false,
  isError = false,
}: StatusScreenProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-4 text-center",
        fullScreen ? "min-h-dvh bg-canvas text-ink" : "py-16"
      )}
    >
      <div role={isError ? "alert" : undefined} className="w-full max-w-md space-y-3">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        <p className="text-[15px] leading-6 text-ink-2">{message}</p>
        {reference && (
          <p className="text-[13px] text-ink-3">
            Reference: <span className="font-mono">{reference}</span>
          </p>
        )}
      </div>
      <div className="mt-6 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row">
        {primaryAction}
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full px-6 sm:w-auto" })}
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default StatusScreen;
