import React from "react";
import { cn } from "@/lib/utils";

/**
 * The FitTracker mark: a machined barbell with a cobalt centre index over a
 * calibrated scale, on a carbon tile. Fixed brand colours (the same in both
 * themes), from the --brand-* tokens in app/globals.css.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="96" height="96" rx="22" fill="var(--brand-carbon)" />
      <rect x="0.75" y="0.75" width="94.5" height="94.5" rx="21.25" stroke="var(--brand-rim)" strokeWidth="1.5" />
      <rect x="16" y="30" width="7" height="24" rx="2.5" fill="var(--brand-graphite)" />
      <rect x="26" y="22" width="10" height="40" rx="3" fill="var(--brand-steel)" />
      <rect x="36" y="39" width="24" height="6" fill="var(--brand-steel)" />
      <rect x="60" y="22" width="10" height="40" rx="3" fill="var(--brand-steel)" />
      <rect x="73" y="30" width="7" height="24" rx="2.5" fill="var(--brand-graphite)" />
      <rect x="46.5" y="36" width="3" height="12" rx="1.5" fill="var(--brand-accent)" />
      <rect x="20" y="72" width="56" height="5" rx="2.5" fill="var(--brand-track)" />
      <rect x="20" y="72" width="38" height="5" rx="2.5" fill="var(--brand-accent)" />
    </svg>
  );
}

/** Mark + "FitTracker". */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-base font-semibold tracking-[-0.02em] text-ink", className)}>
      <BrandMark size={size} />
      <span>FitTracker</span>
    </span>
  );
}

export default BrandMark;
