import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressTrackProps {
  /** Current amount. */
  value: number;
  /** Target; the fill is clamped to 0..max. */
  max: number;
  /** md 6px (hero metric), sm 4px (cells and rows). */
  size?: "sm" | "md";
  /** Ink for progress; accent only for what is live (rest timer, today). */
  tone?: "ink" | "accent";
  /** Accessible name. Without one the track is decorative (the number next to it says it). */
  label?: string;
  className?: string;
}

/** A calibrated progress track: ink fill with fine ticks at 25 / 50 / 75 %. */
export function ProgressTrack({ value, max, size = "md", tone = "ink", label, className }: ProgressTrackProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const a11y = label
    ? {
        role: "progressbar" as const,
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(safeMax),
        "aria-valuenow": Math.round(Math.min(value, safeMax)),
      }
    : { "aria-hidden": true };

  return (
    <div
      {...a11y}
      className={cn(
        "track-ticks relative w-full overflow-hidden bg-elevated",
        size === "md" ? "h-1.5 rounded-[3px]" : "h-1 rounded-[2px]",
        className
      )}
    >
      <div
        className={cn("h-full rounded-[inherit] transition-[width] duration-300", tone === "ink" ? "bg-ink" : "bg-accent")}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export default ProgressTrack;
