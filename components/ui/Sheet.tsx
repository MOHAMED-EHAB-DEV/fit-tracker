"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useDialogOverlay } from "@/hooks/useDialogOverlay";
import { OVERLAY_ROOT_ATTRIBUTE, trapTabKey } from "@/lib/ui/overlay-stack";
import { cn } from "@/lib/utils";

export type SheetSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
export type SheetSide = "bottom" | "top" | "left" | "right";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Actions pinned under the content (Save, Cancel). */
  footer?: React.ReactNode;
  /** Width of the centred dialog from 768px. md = 480px. */
  size?: SheetSize;
  /**
   * bottom (default): a bottom sheet on phones, a centred dialog from 768px.
   * left / right / top: a panel along that edge (kept for older screens).
   */
  side?: SheetSide;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  /** Classes for the panel. */
  className?: string;
  /** Classes for the scrolling content area. */
  bodyClassName?: string;
  ariaLabel?: string;
}

const DIALOG_WIDTH: Record<SheetSize, string> = {
  sm: "md:max-w-[400px]",
  md: "md:max-w-[480px]",
  lg: "md:max-w-[560px]",
  xl: "md:max-w-[672px]",
  "2xl": "md:max-w-4xl",
  "3xl": "md:max-w-5xl",
  full: "md:max-w-[95vw] md:h-full",
};

const CONTAINER: Record<SheetSide, string> = {
  bottom: "items-end justify-center md:items-center md:p-6",
  top: "items-start justify-center",
  right: "items-stretch justify-end",
  left: "items-stretch justify-start",
};

const PANEL: Record<SheetSide, string> = {
  bottom: "sheet-dialog w-full max-h-[92%] rounded-t-card md:max-h-full md:rounded-card",
  top: "w-full max-h-[92%] rounded-b-card border-t-0 border-b border-(--glass-border) sm:max-w-2xl",
  right: "h-full w-full max-w-md border-t-0 border-s border-(--glass-border)",
  left: "h-full w-full max-w-md border-t-0 border-e border-(--glass-border)",
};

const ENTER: Record<SheetSide, string> = {
  bottom: "sheet-in",
  top: "drawer-in-top",
  right: "drawer-in-right",
  left: "drawer-in-left",
};

const EXIT: Record<SheetSide, string> = {
  bottom: "translate-y-full md:translate-y-2 md:scale-[0.98] md:opacity-0",
  top: "-translate-y-full",
  right: "translate-x-full rtl:-translate-x-full",
  left: "-translate-x-full rtl:translate-x-full",
};

/**
 * The one overlay for tasks: a glass bottom sheet on phones (within thumb
 * reach, above the keyboard), a centred 480px glass dialog from 768px.
 *
 * Focus moves into it when it opens and back to the trigger when it closes;
 * Tab stays inside; Escape and the Back button close only the top layer; the
 * page behind is inert and does not scroll.
 */
export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "bottom",
  showCloseButton = true,
  closeOnBackdropClick = true,
  className,
  bodyClassName,
  ariaLabel,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { isMounted, shouldRender, isAnimatingOut } = useDialogOverlay({
    isOpen,
    onClose,
    durationMs: 220,
    lockScroll: true,
    closeOnEscape: true,
    dialogRef: panelRef,
  });

  if (!isMounted || !shouldRender || typeof document === "undefined") return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) onClose();
  };

  const hasHeader = Boolean(title || description || showCloseButton);

  return createPortal(
    // The scrim is a sibling of the panel, never its parent: an ancestor with
    // opacity (the fade) would become the panel's backdrop root, and the glass
    // could no longer blur the page behind it.
    <div
      role="presentation"
      {...{ [OVERLAY_ROOT_ATTRIBUTE]: "" }}
      onClick={handleBackdropClick}
      className={cn("fixed inset-x-0 overlay-area z-[60] flex", CONTAINER[side])}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-scrim transition-opacity duration-200 ease-out",
          isAnimatingOut ? "opacity-0" : "opacity-100 overlay-fade-in"
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        aria-labelledby={title && !ariaLabel && typeof title !== "string" ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => panelRef.current && trapTabKey(event, panelRef.current)}
        className={cn(
          "glass-sheet relative flex flex-col overflow-hidden text-ink outline-none transition-[opacity,transform] duration-200 ease-out",
          PANEL[side],
          side === "bottom" && DIALOG_WIDTH[size],
          isAnimatingOut ? EXIT[side] : ENTER[side],
          className
        )}
      >
        {side === "bottom" && (
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" />
        )}

        {hasHeader && (
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 pb-3 md:px-6 md:pt-5">
            <div className="min-w-0 space-y-0.5 pt-1">
              {title && (
                <h2 id={titleId} className="text-[19px] font-semibold leading-6 tracking-[-0.015em] text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="text-[13px] leading-5 text-ink-2">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <IconButton label="Close" icon={<X className="h-5 w-5" />} onClick={onClose} className="-me-2" />
            )}
          </header>
        )}

        <section
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6 md:pb-6",
            !hasHeader && "pt-4 md:pt-6",
            bodyClassName
          )}
        >
          {children}
        </section>

        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
            {footer}
          </footer>
        ) : (
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)] md:hidden" aria-hidden="true" />
        )}
      </div>
    </div>,
    document.body
  );
}

export default Sheet;
