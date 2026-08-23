"use client";

import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogOverlay } from "@/hooks/useDialogOverlay";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SIZE_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[95vw] h-[90vh]",
};

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
  const modalRef = useRef<HTMLDivElement>(null);
  const { isMounted, shouldRender, isAnimatingOut } = useDialogOverlay({
    isOpen,
    onClose,
    durationMs: 220,
    lockScroll: true,
    closeOnEscape: true,
  });

  if (!isMounted || !shouldRender || typeof document === "undefined") return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-9999 isolate flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md transition-opacity duration-200 ease-out pointer-events-auto",
        isAnimatingOut ? "opacity-0" : "opacity-100"
      )}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
        aria-labelledby={title && !ariaLabel ? "modal-title" : undefined}
        aria-describedby={description ? "modal-description" : undefined}
        className={cn(
          "w-full bg-zinc-900/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.8),0_0_1px_1px_rgba(255,255,255,0.08)] rounded-[28px] overflow-hidden flex flex-col max-h-[90vh] text-zinc-100 transition-all duration-200 ease-out transform ring-1 ring-white/5",
          SIZE_MAP[size],
          isAnimatingOut
            ? "opacity-0 scale-95 translate-y-3"
            : "opacity-100 scale-100 translate-y-0",
          className
        )}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <header className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/6 shrink-0">
            <div className="space-y-0.5">
              {title && (
                <h2 id="modal-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-xs text-zinc-400">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/4 hover:bg-white/10 active:scale-90 transition-all duration-150 ml-auto shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            )}
          </header>
        )}

        {/* Modal Body */}
        <section className="p-6 overflow-y-auto flex-1">{children}</section>

        {/* Modal Footer */}
        {footer && (
          <footer className="px-6 py-4 border-t border-white/6 bg-white/2 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
