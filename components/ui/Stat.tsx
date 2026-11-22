import React from "react";
import { cn } from "@/lib/utils";

export interface StatProps {
  label: React.ReactNode;
  /** The number. Rendered in Plex Mono with tabular figures. */
  value: React.ReactNode;
  /** Small trailing text after the number ("kcal left", "/ 180 g"). */
  unit?: React.ReactNode;
  /** A line under the value. */
  caption?: React.ReactNode;
  /** md 14px (ledger cells), lg 18px (summary strips), display 32px (hero metric). */
  size?: "md" | "lg" | "display";
  /** Status colour for the number only (warn = over target). */
  tone?: "ink" | "ok" | "warn" | "danger";
  className?: string;
  children?: React.ReactNode;
}

const VALUE_SIZE = {
  md: "text-sm font-medium",
  lg: "text-lg font-semibold tracking-[-0.02em]",
  display: "text-display font-medium",
};

const TONE = {
  ink: "text-ink",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

/** A labelled number: label above, mono value with a quiet unit. */
export function Stat({ label, value, unit, caption, size = "md", tone = "ink", className, children }: StatProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs text-ink-3">{label}</span>
      <span className={cn("whitespace-nowrap font-mono tabular-nums", VALUE_SIZE[size], TONE[tone])}>
        {value}
        {unit && (
          <span
            className={cn(
              "font-normal text-ink-3",
              size === "display" ? "ms-1 font-sans text-sm text-ink-2" : "text-xs"
            )}
          >
            {size === "display" ? unit : <> {unit}</>}
          </span>
        )}
      </span>
      {caption && <span className="text-xs text-ink-3">{caption}</span>}
      {children}
    </div>
  );
}

export default Stat;
