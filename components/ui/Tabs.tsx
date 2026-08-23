"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  selectedId: string;
  onSelectionChange: (id: string) => void;
  variant?: "solid" | "bordered" | "underlined" | "light";
  radius?: "sm" | "md" | "lg" | "full";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const RADIUS_MAP = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
};

const SIZE_MAP = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-xs sm:text-sm gap-2",
  lg: "px-5 py-2.5 text-sm sm:text-base gap-2.5",
};

export function Tabs({
  items,
  selectedId,
  onSelectionChange,
  variant = "solid",
  radius = "xl" as any,
  size = "md",
  className,
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center p-1.5 gap-1 backdrop-blur-xl select-none",
        variant === "solid" && "bg-zinc-950/80 border border-white/10 rounded-[22px]",
        variant === "bordered" && "bg-transparent border border-white/15 rounded-[22px]",
        variant === "light" && "bg-transparent gap-1.5",
        variant === "underlined" && "border-b border-white/10 rounded-none p-0 gap-4",
        className
      )}
    >
      {items.map((tab) => {
        const isSelected = tab.id === selectedId;

        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onSelectionChange(tab.id)}
            className={cn(
              "relative font-bold transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95",
              SIZE_MAP[size],
              RADIUS_MAP[radius as keyof typeof RADIUS_MAP] || "rounded-xl",
              isSelected
                ? variant === "underlined"
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "bg-zinc-800 text-white shadow-md shadow-black/40 border border-white/10"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
              tab.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
