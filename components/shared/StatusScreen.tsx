import React from "react";
import Link from "next/link";
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

export const STATUS_PRIMARY_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-6 text-base font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer sm:w-auto";

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
        fullScreen ? "min-h-dvh bg-app text-ink" : "py-16"
      )}
    >
      <div role={isError ? "alert" : undefined} className="w-full max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-base text-zinc-300">{message}</p>
        {reference && <p className="text-sm text-zinc-400">Reference: {reference}</p>}
      </div>
      <div className="mt-6 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row">
        {primaryAction}
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/15 px-6 text-base font-semibold text-zinc-200 hover:bg-white/5 sm:w-auto"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default StatusScreen;
