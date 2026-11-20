import { useEffect, useRef, useState, type RefObject } from "react";
import {
  focusableElements,
  lockBodyScroll,
  makeBackgroundInert,
  registerOverlay,
  trackVisibleArea,
} from "@/lib/ui/overlay-stack";

interface UseDialogOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  durationMs?: number;
  lockScroll?: boolean;
  /** Escape (and the Android Back button, where the platform reports it) closes the dialog. */
  closeOnEscape?: boolean;
  /** The dialog element: focus moves into it on open and returns on close. */
  dialogRef?: RefObject<HTMLElement | null>;
}

interface UseDialogOverlayReturn {
  isMounted: boolean;
  shouldRender: boolean;
  isAnimatingOut: boolean;
}

/**
 * Behaviour shared by Modal and Drawer: mount/exit animation timing, scroll
 * lock, Escape and Back handling (top layer only), an inert background, and
 * focus that moves into the dialog and back to where it came from.
 */
export function useDialogOverlay({
  isOpen,
  onClose,
  durationMs = 200,
  lockScroll = true,
  closeOnEscape = true,
  dialogRef,
}: UseDialogOverlayOptions): UseDialogOverlayReturn {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portals need a client-only mount flag
    setIsMounted(true);
  }, []);

  // Presence: keep rendering while the exit animation plays.
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- presence state follows the isOpen prop
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

  // Top-layer bookkeeping: Escape, Back, scroll lock, inert background.
  useEffect(() => {
    if (!isOpen) return;

    const releaseOverlay = closeOnEscape ? registerOverlay(() => onCloseRef.current()) : () => undefined;
    const releaseScroll = lockScroll ? lockBodyScroll() : () => undefined;
    const releaseInert = makeBackgroundInert();
    const releaseArea = trackVisibleArea();

    return () => {
      releaseArea();
      releaseInert();
      releaseScroll();
      releaseOverlay();
    };
  }, [isOpen, lockScroll, closeOnEscape]);

  // Focus: into the dialog on open, back to the trigger on close.
  useEffect(() => {
    if (!isOpen || !isMounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef?.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus], [autofocus]");
      const target = preferred || focusableElements(dialog)[0] || dialog;
      target.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, isMounted, dialogRef]);

  return { isMounted, shouldRender, isAnimatingOut };
}

export default useDialogOverlay;
