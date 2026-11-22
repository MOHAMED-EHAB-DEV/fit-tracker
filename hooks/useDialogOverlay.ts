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

  // Top-layer bookkeeping: Escape, Back, scroll lock, inert background, and
  // focus back to the trigger on close.
  useEffect(() => {
    if (!isOpen) return;

    // Remember the trigger before the background turns inert: an inert
    // ancestor blurs it, and focus would otherwise come back to <body>.
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const releaseOverlay = closeOnEscape ? registerOverlay(() => onCloseRef.current()) : () => undefined;
    const releaseScroll = lockScroll ? lockBodyScroll() : () => undefined;
    const releaseInert = makeBackgroundInert();
    const releaseArea = trackVisibleArea();

    return () => {
      releaseArea();
      releaseInert();
      releaseScroll();
      releaseOverlay();
      // Only after the background is interactive again can it take focus.
      if (trigger && trigger !== document.body && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [isOpen, lockScroll, closeOnEscape]);

  // Focus moves into the dialog on open, once the panel is actually rendered
  // (the presence flag can turn on a render after isOpen does).
  useEffect(() => {
    if (!isOpen || !isMounted || !shouldRender) return;

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef?.current;
      if (!dialog || dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus], [autofocus]");
      const target = preferred || focusableElements(dialog)[0] || dialog;
      target.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, isMounted, shouldRender, dialogRef]);

  return { isMounted, shouldRender, isAnimatingOut };
}

export default useDialogOverlay;
