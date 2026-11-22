import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Status chips colour their text only; everything else is neutral. */
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
  size?: "sm" | "md" | "lg";
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  onClose?: () => void;
  /** Accessible name of the remove button. */
  closeLabel?: string;
}

const TONE = {
  neutral: "text-ink-2",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

const SIZE = {
  sm: "h-5 px-1.5 gap-1",
  md: "h-6 px-2 gap-1",
  lg: "h-7 px-2.5 gap-1.5",
};

/** A small label: meal type, "Custom", "Suggested", set counts. */
export function Chip({
  tone = "neutral",
  size = "md",
  startContent,
  endContent,
  onClose,
  closeLabel = "Remove",
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-chip border border-line bg-elevated text-xs font-medium select-none",
        SIZE[size],
        TONE[tone],
        className
      )}
      {...props}
    >
      {startContent && (
        <span className="flex shrink-0" aria-hidden="true">
          {startContent}
        </span>
      )}
      <span className="truncate">{children}</span>
      {endContent && <span className="flex shrink-0">{endContent}</span>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="-me-1 ms-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[4px] text-ink-3 hover:bg-line hover:text-ink cursor-pointer"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

/** A toggle in a row of filters (muscle group, equipment). The chosen one is filled with ink. */
export function FilterChip({ selected, onClick, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center rounded-chip border px-3 text-[13px] transition-colors cursor-pointer",
        selected
          ? "border-ink bg-ink font-semibold text-ink-inverse"
          : "border-line bg-surface font-medium text-ink-2 hover:border-line-strong hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}

export default Chip;
