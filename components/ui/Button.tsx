"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "bordered" | "flat" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  radius?: "none" | "sm" | "md" | "lg" | "full";
  isLoading?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

const VARIANT_MAP = {
  solid:
    "bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold shadow-lg shadow-emerald-500/25",
  bordered:
    "bg-transparent border border-white/15 hover:border-white/30 text-zinc-200 hover:text-white hover:bg-white/[0.04]",
  flat:
    "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/20 font-bold",
  ghost:
    "bg-transparent text-zinc-400 hover:text-white hover:bg-white/10",
  danger:
    "bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg shadow-red-500/25",
};

const SIZE_MAP = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-xs sm:text-sm gap-2",
  lg: "px-6 py-3.5 text-sm sm:text-base gap-2.5",
};

const RADIUS_MAP = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "solid",
      size = "md",
      radius = "lg",
      isLoading = false,
      startContent,
      endContent,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer disabled:opacity-50 disabled:pointer-events-none select-none",
          VARIANT_MAP[variant],
          SIZE_MAP[size],
          RADIUS_MAP[radius],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          startContent && <span className="shrink-0">{startContent}</span>
        )}
        <span>{children}</span>
        {!isLoading && endContent && <span className="shrink-0">{endContent}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
