"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";
import { registerOverlay } from "@/lib/ui/overlay-stack";

export interface UsePopoverOptions<F extends HTMLElement = HTMLElement> {
  initialOpen?: boolean;
  durationMs?: number;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  onOpenChange?: (open: boolean) => void;
  floatingRef?: RefObject<F | null>;
  additionalRefs?: RefObject<HTMLElement | null>[];
}

export interface UsePopoverReturn<T extends HTMLElement, F extends HTMLElement = HTMLElement> {
  isOpen: boolean;
  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  containerRef: RefObject<T | null>;
  floatingRef: RefObject<F | null>;
  shouldRender: boolean;
  isAnimatingIn: boolean;
  isAnimatingOut: boolean;
}

/**
 * Unified composite hook for Dropdowns, Selects, and Popovers.
 * Combines open/close state, click-outside detection (supporting portaled elements), Escape key dismissal, and presence animations.
 */
export function usePopover<T extends HTMLElement = HTMLDivElement, F extends HTMLElement = HTMLElement>({
  initialOpen = false,
  durationMs = 150,
  closeOnEscape = true,
  closeOnClickOutside = true,
  onOpenChange,
  floatingRef: externalFloatingRef,
  additionalRefs,
}: UsePopoverOptions<F> = {}): UsePopoverReturn<T, F> {
  const [isOpen, setIsOpenState] = useState(initialOpen);
  const containerRef = useRef<T>(null);
  const internalFloatingRef = useRef<F>(null);
  const floatingRef = externalFloatingRef || internalFloatingRef;

  const setIsOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next !== prev) {
          onOpenChange?.(next);
        }
        return next;
      });
    },
    [onOpenChange]
  );

  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [setIsOpen]);

  // 1. Presence and enter/exit animation timing
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [hasEntered, setHasEntered] = useState(false);

  // Opening mounts the element in the same render (no extra effect pass).
  if (isOpen && !shouldRender) setShouldRender(true);

  useEffect(() => {
    if (isOpen) {
      // Two frames: the element is mounted and positioned before the enter transition starts.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setHasEntered(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    if (!shouldRender) return;
    const timeoutId = setTimeout(() => {
      setShouldRender(false);
      setHasEntered(false);
    }, durationMs);
    return () => clearTimeout(timeoutId);
  }, [isOpen, durationMs, shouldRender]);

  const isAnimatingIn = isOpen && hasEntered;
  const isAnimatingOut = !isOpen && shouldRender;

  // 2. Click Outside Detection (Mouse & Touch, checking both trigger and portaled floating element)
  useEffect(() => {
    if (!closeOnClickOutside || !isOpen) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      // Check if click was inside container/trigger
      if (containerRef.current?.contains(target)) {
        return;
      }

      // Check if click was inside portaled floating menu/popover
      if (floatingRef.current?.contains(target)) {
        return;
      }

      // Check additional refs if provided
      for (const ref of additionalRefs || []) {
        if (ref.current?.contains(target)) {
          return;
        }
      }

      close();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [isOpen, closeOnClickOutside, close, floatingRef, additionalRefs]);

  // 3. Escape Key Listener
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    // Joins the shared overlay stack so Escape closes only the top layer
    // (a select inside a dialog closes first, then the dialog).
    return registerOverlay(close);
  }, [isOpen, closeOnEscape, close]);

  return {
    isOpen,
    setIsOpen,
    open,
    close,
    toggle,
    containerRef,
    floatingRef,
    shouldRender,
    isAnimatingIn,
    isAnimatingOut,
  };
}

export default usePopover;
