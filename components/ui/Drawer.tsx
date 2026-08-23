"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOverlay } from "@/hooks/useDialogOverlay";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: "bottom" | "right" | "left" | "top";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  position = "bottom",
  showCloseButton = true,
  closeOnBackdropClick = true,
  className,
  ariaLabel,
}: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const { isMounted, shouldRender, isAnimatingOut } = useDialogOverlay({
    isOpen,
    onClose,
    durationMs: 280,
    lockScroll: true,
    closeOnEscape: true,
  });

  if (!isMounted || !shouldRender || typeof document === "undefined") return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case "bottom":
        return cn(
          "w-full max-h-[92vh] rounded-t-[36px] border-t border-white/12 shadow-[0_-25px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]",
          isAnimatingOut ? "translate-y-full" : "translate-y-0"
        );
      case "right":
        return cn(
          "h-full w-full max-w-md rounded-l-[36px] border-l border-white/12 shadow-[-25px_0_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]",
          isAnimatingOut ? "translate-x-full" : "translate-x-0"
        );
      case "left":
        return cn(
          "h-full w-full max-w-md rounded-r-[36px] border-r border-white/12 shadow-[25px_0_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]",
          isAnimatingOut ? "-translate-x-full" : "translate-x-0"
        );
      case "top":
        return cn(
          "w-full max-h-[85vh] rounded-b-[36px] border-b border-white/12 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]",
          isAnimatingOut ? "-translate-y-full" : "translate-y-0"
        );
    }
  };

  return createPortal(
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-9999 isolate bg-black/75 backdrop-blur-md transition-opacity duration-280 ease-out flex pointer-events-auto",
        position === "bottom" && "items-end",
        position === "right" && "justify-end",
        position === "left" && "justify-start",
        position === "top" && "items-start",
        isAnimatingOut ? "opacity-0" : "opacity-100"
      )}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        aria-labelledby={title && !ariaLabel ? "drawer-title" : undefined}
        aria-describedby={description ? "drawer-description" : undefined}
        className={cn(
          "bg-zinc-950/95 backdrop-blur-3xl overflow-hidden flex flex-col text-zinc-100 transition-transform duration-280 ease-[cubic-bezier(0.16,1,0.3,1)]",
          getPositionClasses(),
          className
        )}
      >
        {/* Tactile Pull Grabber */}
        {position === "bottom" && (
          <div role="presentation" aria-hidden="true" className="w-full flex items-center justify-center pt-3.5 pb-1">
            <div className="w-14 h-1.5 rounded-full bg-white/20 hover:bg-white/35 active:bg-emerald-400/80 transition-all duration-200 cursor-grab" />
          </div>
        )}

        {/* Drawer Header */}
        {(title || showCloseButton) && (
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
            <div className="space-y-0.5">
              {title && (
                <h2 id="drawer-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="drawer-description" className="text-xs text-zinc-400">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-white/4 hover:bg-white/10 active:scale-90 transition-all duration-150 ml-auto shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </header>
        )}

        {/* Content Body */}
        <section className="p-6 overflow-y-auto flex-1">{children}</section>

        {/* Footer */}
        {footer && (
          <footer className="px-6 py-4 border-t border-white/6 bg-white/2 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}

export default Drawer;
