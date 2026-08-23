"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "solid" | "bordered" | "flat" | "dot";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  onClose?: () => void;
}

const COLOR_MAP = {
  default: {
    solid: "bg-zinc-800 text-zinc-200",
    bordered: "border-white/15 text-zinc-300 bg-transparent",
    flat: "bg-white/5 text-zinc-300 border border-white/10",
    dot: "bg-zinc-900/80 text-zinc-300 border border-white/10",
    dotColor: "bg-zinc-400",
  },
  primary: {
    solid: "bg-emerald-500 text-zinc-950 font-black",
    bordered: "border-emerald-500/50 text-emerald-300 bg-transparent",
    flat: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25",
    dot: "bg-zinc-950 text-emerald-300 border border-emerald-500/20",
    dotColor: "bg-emerald-400",
  },
  secondary: {
    solid: "bg-teal-500 text-zinc-950 font-black",
    bordered: "border-teal-500/50 text-teal-300 bg-transparent",
    flat: "bg-teal-500/15 text-teal-300 border border-teal-500/25",
    dot: "bg-zinc-950 text-teal-300 border border-teal-500/20",
    dotColor: "bg-teal-400",
  },
  success: {
    solid: "bg-emerald-500 text-zinc-950 font-bold",
    bordered: "border-emerald-500 text-emerald-400 bg-transparent",
    flat: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    dot: "bg-zinc-950 text-emerald-300 border border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  warning: {
    solid: "bg-amber-500 text-zinc-950 font-bold",
    bordered: "border-amber-500 text-amber-300 bg-transparent",
    flat: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    dot: "bg-zinc-950 text-amber-300 border border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  danger: {
    solid: "bg-red-500 text-white font-bold",
    bordered: "border-red-500 text-red-300 bg-transparent",
    flat: "bg-red-500/15 text-red-300 border border-red-500/30",
    dot: "bg-zinc-950 text-red-300 border border-red-500/30",
    dotColor: "bg-red-400",
  },
};

const SIZE_MAP = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3.5 py-1.5 text-sm gap-2",
};

export function Chip({
  children,
  variant = "flat",
  color = "primary",
  size = "md",
  startContent,
  endContent,
  onClose,
  className,
  ...props
}: ChipProps) {
  const scheme = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-bold select-none transition-all duration-150",
        scheme[variant],
        SIZE_MAP[size],
        className
      )}
      {...props}
    >
      {variant === "dot" && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", scheme.dotColor)} />
      )}
      {startContent && <span className="shrink-0">{startContent}</span>}
      <span className="truncate">{children}</span>
      {endContent && <span className="shrink-0">{endContent}</span>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded-full hover:bg-white/20 transition shrink-0 ml-0.5"
          aria-label="Remove chip"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default Chip;
