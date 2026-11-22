"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface SuggestedCardProps {
  /** What the suggestion is about ("Photo scan · Tap to edit", "Routine update"). */
  meta?: React.ReactNode;
  children: React.ReactNode;
  /** "suggested" shows Accept / Dismiss; "applied" shows the Applied badge instead. */
  state?: "suggested" | "applied";
  onAccept?: () => void;
  onDismiss?: () => void;
  acceptLabel?: string;
  dismissLabel?: string;
  isAccepting?: boolean;
  /** While the AI is still working: show a skeleton instead of the children. */
  isLoading?: boolean;
  className?: string;
}

/**
 * AI output, always waiting for the user: a dashed hairline container labelled
 * "Suggested" with Accept / Dismiss. Never accent-filled; "Applied" after accept.
 */
export function SuggestedCard({
  meta,
  children,
  state = "suggested",
  onAccept,
  onDismiss,
  acceptLabel = "Accept",
  dismissLabel = "Dismiss",
  isAccepting = false,
  isLoading = false,
  className,
}: SuggestedCardProps) {
  const applied = state === "applied";
  return (
    <section
      aria-label={applied ? "Applied suggestion" : "Suggestion"}
      aria-busy={isLoading || undefined}
      className={cn(
        "flex flex-col gap-2.5 rounded-card border-[1.5px] border-dashed border-line-strong bg-surface px-3.5 py-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-line bg-elevated px-2 text-xs font-medium text-ink-2">
          {applied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {applied ? "Applied" : "Suggested"}
        </span>
        {meta && <span className="truncate text-xs font-medium text-ink-3">{meta}</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}

      {!applied && !isLoading && (onAccept || onDismiss) && (
        <div className="grid grid-cols-2 gap-2">
          {onAccept && (
            <Button size="sm" onClick={onAccept} isLoading={isAccepting} fullWidth>
              {acceptLabel}
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="secondary" onClick={onDismiss} disabled={isAccepting} fullWidth>
              {dismissLabel}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export default SuggestedCard;
