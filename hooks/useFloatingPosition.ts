"use client";

import { useState, useEffect, useLayoutEffect, useCallback, RefObject } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type FloatingAlign = "left" | "right" | "center" | "full";
export type FloatingSide = "top" | "bottom" | "left" | "right";

export interface UseFloatingPositionOptions {
  triggerRef: RefObject<HTMLElement | null>;
  floatingRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  align?: FloatingAlign;
  side?: FloatingSide;
  offset?: number;
  matchWidth?: boolean;
  autoFlip?: boolean;
}

export interface FloatingPosition {
  top: number;
  left: number;
  width?: number;
  actualSide: FloatingSide;
  isReady: boolean;
}

export function useFloatingPosition({
  triggerRef,
  floatingRef,
  isOpen,
  align = "left",
  side = "bottom",
  offset = 8,
  matchWidth = false,
  autoFlip = true,
}: UseFloatingPositionOptions) {
  const computeCoords = useCallback((): FloatingPosition | null => {
    if (!triggerRef.current || typeof window === "undefined") return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const floatingEl = floatingRef.current;

    const floatingWidth = floatingEl && floatingEl.offsetWidth > 0 ? floatingEl.offsetWidth : (matchWidth ? triggerRect.width : 220);
    const floatingHeight = floatingEl && floatingEl.offsetHeight > 0 ? floatingEl.offsetHeight : 220;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    let computedSide: FloatingSide = side;
    let top = 0;
    let left = 0;

    // Handle Top / Bottom placement
    if (side === "top" || side === "bottom") {
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      if (autoFlip) {
        if (side === "bottom" && spaceBelow < floatingHeight + offset && spaceAbove > spaceBelow) {
          computedSide = "top";
        } else if (side === "top" && spaceAbove < floatingHeight + offset && spaceBelow > spaceAbove) {
          computedSide = "bottom";
        }
      }

      if (computedSide === "top") {
        top = triggerRect.top - floatingHeight - offset;
      } else {
        top = triggerRect.bottom + offset;
      }

      // Horizontal alignment
      if (matchWidth) {
        left = triggerRect.left;
      } else if (align === "left") {
        left = triggerRect.left;
      } else if (align === "right") {
        left = triggerRect.right - floatingWidth;
      } else if (align === "center") {
        left = triggerRect.left + (triggerRect.width - floatingWidth) / 2;
      }

      // Clamp horizontally within viewport
      if (matchWidth) {
        if (left < padding) left = padding;
      } else {
        left = Math.max(padding, Math.min(left, viewportWidth - floatingWidth - padding));
      }
    } else {
      // Left / Right placement
      const spaceRight = viewportWidth - triggerRect.right;
      const spaceLeft = triggerRect.left;

      if (autoFlip) {
        if (side === "right" && spaceRight < floatingWidth + offset && spaceLeft > spaceRight) {
          computedSide = "left";
        } else if (side === "left" && spaceLeft < floatingWidth + offset && spaceRight > spaceLeft) {
          computedSide = "right";
        }
      }

      if (computedSide === "left") {
        left = triggerRect.left - floatingWidth - offset;
      } else {
        left = triggerRect.right + offset;
      }

      // Vertically center with trigger
      top = triggerRect.top + (triggerRect.height - floatingHeight) / 2;
      top = Math.max(padding, Math.min(top, viewportHeight - floatingHeight - padding));
    }

    return {
      top: Math.round(top),
      left: Math.round(left),
      width: matchWidth ? Math.round(triggerRect.width) : undefined,
      actualSide: computedSide,
      isReady: true,
    };
  }, [triggerRef, floatingRef, align, side, offset, matchWidth, autoFlip]);

  const [position, setPosition] = useState<FloatingPosition>(() => {
    return (
      computeCoords() || {
        top: 0,
        left: 0,
        actualSide: side,
        isReady: false,
      }
    );
  });

  const updatePosition = useCallback(() => {
    if (!isOpen || !triggerRef.current) return;
    const computed = computeCoords();
    if (computed) {
      setPosition(computed);
    }
  }, [isOpen, triggerRef, computeCoords]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const rafId = requestAnimationFrame(updatePosition);

    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    window.addEventListener("resize", updatePosition, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  return {
    ...position,
    updatePosition,
    style: {
      position: "fixed" as const,
      top: `${position.top}px`,
      left: `${position.left}px`,
      width: position.width ? `${position.width}px` : undefined,
      zIndex: 9999,
    },
  };
}

export default useFloatingPosition;
