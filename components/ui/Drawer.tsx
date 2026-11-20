"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOverlay } from "@/hooks/useDialogOverlay";
import { OVERLAY_ROOT_ATTRIBUTE, trapTabKey } from "@/lib/ui/overlay-stack";
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

const CONTAINER: Record<NonNullable<DrawerProps["position"]>, string> = {
  bottom: "items-end justify-center",
  top: "items-start justify-center",
  right: "items-stretch justify-end",
  left: "items-stretch justify-start",
};

const PANEL: Record<NonNullable<DrawerProps["position"]>, string> = {
  bottom: "w-full sm:max-w-2xl max-h-[92%] rounded-t-3xl border-t",
  top: "w-full sm:max-w-2xl max-h-[92%] rounded-b-3xl border-b",
  right: "h-full w-full max-w-md border-s",
  left: "h-full w-full max-w-md border-e",
};

const HIDDEN: Record<NonNullable<DrawerProps["position"]>, string> = {
  bottom: "translate-y-full",
  top: "-translate-y-full",
  right: "translate-x-full rtl:-translate-x-full",
  left: "-translate-x-full rtl:translate-x-full",
};

const ENTER: Record<NonNullable<DrawerProps["position"]>, string> = {
  bottom: "drawer-in-bottom",
  top: "drawer-in-top",
  right: "drawer-in-right",
  left: "drawer-in-left",
};

/**
 * A panel that slides in from an edge. Same focus, Escape and Back-button
 * behaviour as Modal.
 */
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
  const titleId = useId();
  const descriptionId = useId();
  const { isMounted, shouldRender, isAnimatingOut } = useDialogOverlay({
    isOpen,
    onClose,
    durationMs: 240,
    lockScroll: true,
    closeOnEscape: true,
    dialogRef: drawerRef,
  });

  if (!isMounted || !shouldRender || typeof document === "undefined") return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      role="presentation"
      {...{ [OVERLAY_ROOT_ATTRIBUTE]: "" }}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-x-0 overlay-area z-[60] isolate flex bg-black/70 transition-opacity duration-200 ease-out",
        CONTAINER[position],
        isAnimatingOut ? "opacity-0" : "opacity-100 overlay-fade-in"
      )}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        aria-labelledby={title && !ariaLabel && typeof title !== "string" ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => drawerRef.current && trapTabKey(event, drawerRef.current)}
        className={cn(
          "bg-zinc-900 border-white/10 shadow-2xl shadow-black/70 text-zinc-100 flex flex-col overflow-hidden outline-none transition-transform duration-200 ease-out",
          PANEL[position],
          isAnimatingOut ? HIDDEN[position] : cn("translate-x-0 translate-y-0", ENTER[position]),
          className
        )}
      >
        {(title || showCloseButton) && (
          <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-white/10 shrink-0">
            <div className="space-y-1 min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-bold text-white tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-sm text-zinc-400">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-me-2 -mt-1 grid place-items-center w-11 h-11 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </header>
        )}

        <section className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1">{children}</section>

        {footer ? (
          <footer className="px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </footer>
        ) : (
          <div className="pb-[env(safe-area-inset-bottom)] shrink-0" aria-hidden="true" />
        )}
      </aside>
    </div>,
    document.body
  );
}

export default Drawer;
