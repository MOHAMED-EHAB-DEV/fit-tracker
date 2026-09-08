import { useEffect, useState, useRef } from "react";
import { isAndroidNativeApp } from "@/services/webview-bridge";

interface UseDialogOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  durationMs?: number;
  lockScroll?: boolean;
  closeOnEscape?: boolean;
  interceptBackButton?: boolean;
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
  interceptBackButton = true,
}: UseDialogOverlayOptions): UseDialogOverlayReturn {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

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

  // 4. Escape Key Dismissal
  useEffect(() => {
    if (!isOpen || !closeOnEscape || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape]);

  // 5. Android Hardware Back Button Popstate Interception (only active in native Android WebView wrapper)
  useEffect(() => {
    if (!isOpen || !interceptBackButton || typeof window === "undefined" || !isAndroidNativeApp()) return;

    const modalHistoryKey = `modal_state_${Date.now()}`;
    window.history.pushState({ [modalHistoryKey]: true }, "");

    let isClosedByPopState = false;

    const handlePopState = () => {
      isClosedByPopState = true;
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      if (!isClosedByPopState && window.history.state?.[modalHistoryKey]) {
        window.history.back();
      }
    };
  }, [isOpen, interceptBackButton]);

  return { isMounted, shouldRender, isAnimatingOut };
}

export default useDialogOverlay;
