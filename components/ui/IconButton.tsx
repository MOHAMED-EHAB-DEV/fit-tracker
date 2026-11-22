"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name: an icon alone says nothing to a screen reader. */
  label: string;
  icon: React.ReactNode;
  variant?: "ghost" | "secondary";
  /** md: 40px visual, 44px touch area. sm: 32px visual, 44px touch area. */
  size?: "sm" | "md";
}

const VARIANT = {
  ghost: "text-ink-2 hover:bg-elevated hover:text-ink",
  secondary: "bg-elevated text-ink border border-line hover:border-line-strong",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, variant = "ghost", size = "md", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={cn(
        // The ::before extends the touch area to 44px without changing the layout.
        "relative inline-flex shrink-0 items-center justify-center rounded-control cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        size === "md" ? "h-10 w-10" : "h-8 w-8",
        VARIANT[variant],
        className
      )}
      {...props}
    >
      <span className="flex" aria-hidden="true">
        {icon}
      </span>
    </button>
  )
);

IconButton.displayName = "IconButton";

export default IconButton;
