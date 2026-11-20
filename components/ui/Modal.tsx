"use client";

import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOverlay } from "@/hooks/useDialogOverlay";
import { OVERLAY_ROOT_ATTRIBUTE, trapTabKey } from "@/lib/ui/overlay-stack";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE_MAP = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl",
  "3xl": "sm:max-w-5xl",
  full: "sm:max-w-[95vw] sm:h-full",
};

/**
 * The app's dialog. On phones it is a bottom sheet (within thumb reach, above
 * the on-screen keyboard); on larger screens a centred dialog.
 *
 * Focus moves into it when it opens and back to the trigger when it closes;
 * Tab stays inside; Escape and the Back button close only the top dialog.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeOnBackdropClick = true,
  className,
  ariaLabel,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { isMounted, shouldRender, isAnimatingOut } = useDialogOverlay({
    isOpen,
    onClose,
    durationMs: 200,
    lockScroll: true,
    closeOnEscape: true,
    dialogRef,
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
        "fixed inset-x-0 overlay-area z-[60] isolate flex items-end sm:items-center justify-center sm:p-6 bg-black/70 transition-opacity duration-200 ease-out",
        isAnimatingOut ? "opacity-0" : "opacity-100 overlay-fade-in"
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        aria-labelledby={title && !ariaLabel && typeof title !== "string" ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => dialogRef.current && trapTabKey(event, dialogRef.current)}
        className={cn(
          "w-full bg-zinc-900 border border-white/10 shadow-2xl shadow-black/70 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92%] sm:max-h-full text-zinc-100 outline-none transition-[opacity,transform] duration-200 ease-out",
          SIZE_MAP[size],
          isAnimatingOut ? "opacity-0 translate-y-4 sm:scale-95" : "opacity-100 translate-y-0 sm:scale-100 dialog-rise-in",
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

        {footer && (
          <footer className="px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </footer>
        )}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)] sm:hidden shrink-0" aria-hidden="true" />}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
