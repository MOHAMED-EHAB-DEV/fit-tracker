import { useEffect, useState } from "react";

interface UseDialogOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  durationMs?: number;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
}

interface UseDialogOverlayReturn {
  isMounted: boolean;
  shouldRender: boolean;
  isAnimatingOut: boolean;
}

/**
 * Unified composite hook for Modals, Drawers, and Dialog Overlays.
 * Combines SSR-safe mounting, presence animations, body scroll locking, and Escape key dismissal.
 */
export function useDialogOverlay({
  isOpen,
  onClose,
  durationMs = 200,
  lockScroll = true,
  closeOnEscape = true,
}: UseDialogOverlayOptions): UseDialogOverlayReturn {
  // 1. SSR-Safe Client Mount State
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // 2. Presence & Exit Animation Timing
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else if (shouldRender) {
      setIsAnimatingOut(true);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, durationMs);
    }

    return () => clearTimeout(timeoutId);
  }, [isOpen, durationMs, shouldRender]);

  // 3. Body Scroll Locking with Layout-Shift Prevention
  useEffect(() => {
    if (!lockScroll || !isOpen) return;

    const originalOverflow = window.getComputedStyle(document.body).overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen, lockScroll]);

  // 4. Escape Key Handler
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  return { isMounted, shouldRender, isAnimatingOut };
}

export default useDialogOverlay;
