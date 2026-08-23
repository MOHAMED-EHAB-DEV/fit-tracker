"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";

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
  additionalRefs = [],
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

  // 1. Presence & Two-Phase Enter/Exit Animation Timing
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let rafId: number;

    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      // Double-RAF micro-delay to let the browser mount and position the element at exact viewport coordinates before starting the enter transition
      rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true);
        });
      });
    } else if (shouldRender) {
      setIsAnimatingIn(false);
      setIsAnimatingOut(true);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, durationMs);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [isOpen, durationMs, shouldRender]);

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
      for (const ref of additionalRefs) {
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
