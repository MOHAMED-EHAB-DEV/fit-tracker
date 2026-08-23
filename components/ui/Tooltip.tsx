"use client";

import React, { useState, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<any>;
  placement?: "top" | "bottom" | "left" | "right";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  delay?: number;
  className?: string;
}

const COLOR_MAP = {
  default: "bg-zinc-900/95 text-zinc-100 border-white/10",
  primary: "bg-emerald-950/95 text-emerald-200 border-emerald-500/30",
  secondary: "bg-teal-950/95 text-teal-200 border-teal-500/30",
  success: "bg-emerald-900/95 text-white border-emerald-500/40",
  warning: "bg-amber-950/95 text-amber-200 border-amber-500/30",
  danger: "bg-red-950/95 text-red-200 border-red-500/30",
};

export function Tooltip({
  content,
  children,
  placement = "top",
  color = "default",
  delay = 100,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  const { style: floatingStyle } = useFloatingPosition({
    triggerRef,
    floatingRef: tooltipRef,
    isOpen: isVisible,
    side: placement,
    offset: 6,
    autoFlip: true,
  });

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {React.cloneElement(children, {
        "aria-describedby": isVisible ? tooltipId : undefined,
      })}

      {isVisible && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={floatingStyle}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-2xl border shadow-xl shadow-black/60 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95",
              COLOR_MAP[color],
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}

export default Tooltip;
