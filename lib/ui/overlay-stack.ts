import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * One shared stack for everything that sits on top of the page (dialogs,
 * sheets, drawers, popovers). It guarantees that:
 *
 *  - Escape and the Android Back button / gesture close ONLY the top layer;
 *  - the page behind a dialog cannot scroll, and scrolling is restored only
 *    when the last dialog is gone;
 *  - the page behind a modal dialog is inert for keyboard and screen readers.
 *
 * It never adds or removes browser history entries. An earlier version gave
 * each dialog a history entry and removed it again on close; the router
 * reads that removal as "go back" and cancels a navigation started at the
 * same moment, which broke every link inside a sheet.
 *
 * Back is handled where the platform offers a safe way to do it:
 *  - Chrome on Android (browser and installed app) and Escape on desktop:
 *    the CloseWatcher API;
 *  - the FitTracker Android app: it calls window.__ftHandleBack() before it
 *    navigates back;
 *  - browsers without either (Safari, Firefox): Back leaves the page, which
 *    also removes the dialog.
 *
 * Browser only: every function is a no-op on the server.
 */

interface CloseWatcherLike {
  onclose: (() => void) | null;
  destroy(): void;
}
type CloseWatcherConstructor = new () => CloseWatcherLike;

interface OverlayEntry {
  id: number;
  close: () => void;
  /** The browser's close-request listener for this layer, when supported. */
  watcher: CloseWatcherLike | null;
}

let nextId = 1;
const stack: OverlayEntry[] = [];
let listenersAttached = false;

function topEntry(): OverlayEntry | undefined {
  return stack[stack.length - 1];
}

function closeWatcherConstructor(): CloseWatcherConstructor | null {
  const candidate = (window as unknown as { CloseWatcher?: CloseWatcherConstructor }).CloseWatcher;
  return typeof candidate === "function" ? candidate : null;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" && event.key !== "Esc") return;
  const top = topEntry();
  if (!top) return;
  // With a close watcher the browser itself delivers Escape to the top layer.
  if (top.watcher) return;
  event.stopPropagation();
  top.close();
}

/** Closes the top layer. Returns false when nothing is open. */
export function closeTopOverlay(): boolean {
  const top = topEntry();
  if (!top) return false;
  top.close();
  return true;
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("keydown", handleKeyDown, true);
  // Called by the Android app when the user presses Back (see MainActivity.kt).
  (window as unknown as { __ftHandleBack?: () => boolean }).__ftHandleBack = closeTopOverlay;
}

/**
 * Registers an open overlay. Call the returned function when it closes
 * (for any reason).
 */
export function registerOverlay(close: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  ensureListeners();

  const entry: OverlayEntry = { id: nextId++, close, watcher: null };
  stack.push(entry);

  const Watcher = closeWatcherConstructor();
  if (Watcher) {
    try {
      const watcher = new Watcher();
      watcher.onclose = () => {
        // The watcher is spent once it fires.
        entry.watcher = null;
        if (stack.includes(entry)) entry.close();
      };
      entry.watcher = watcher;
    } catch {
      entry.watcher = null;
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
    const watcher = entry.watcher;
    entry.watcher = null;
    try {
      watcher?.destroy();
    } catch {
      // Already inactive.
    }
  };
}

// ---------------------------------------------------------------------------
// Scroll lock (reference counted)
// ---------------------------------------------------------------------------

let scrollLocks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;
  if (scrollLocks === 0) {
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;
    body.style.overflow = "hidden";
  }
  scrollLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
    }
  };
}

// ---------------------------------------------------------------------------
// Visible area (reference counted)
// ---------------------------------------------------------------------------

let areaTrackers = 0;
let stopAreaTracking: (() => void) | null = null;

/**
 * While a dialog is open, publishes the area that is really visible as
 * --overlay-top and --overlay-height on <html> (used by the .overlay-area
 * class). On iPhones the on-screen keyboard covers the page instead of
 * resizing it, so a sheet sized to the page would have its fields and buttons
 * hidden behind the keyboard.
 */
export function trackVisibleArea(): () => void {
  if (typeof window === "undefined" || !window.visualViewport) return () => undefined;
  if (areaTrackers === 0) {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--overlay-height", `${Math.round(viewport.height)}px`);
      root.style.setProperty("--overlay-top", `${Math.round(viewport.offsetTop)}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    stopAreaTracking = () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--overlay-height");
      root.style.removeProperty("--overlay-top");
    };
  }
  areaTrackers += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    areaTrackers = Math.max(0, areaTrackers - 1);
    if (areaTrackers === 0) {
      stopAreaTracking?.();
      stopAreaTracking = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Inert background (reference counted)
// ---------------------------------------------------------------------------

/** Elements rendered into <body> that must stay interactive above a dialog. */
export const OVERLAY_ROOT_ATTRIBUTE = "data-overlay-root";

let inertLocks = 0;
let inertedElements: HTMLElement[] = [];

export function makeBackgroundInert(): () => void {
  if (typeof document === "undefined") return () => undefined;
  if (inertLocks === 0) {
    inertedElements = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute(OVERLAY_ROOT_ATTRIBUTE) || child.hasAttribute("inert")) continue;
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") continue;
      child.setAttribute("inert", "");
      inertedElements.push(child);
    }
  }
  inertLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    inertLocks = Math.max(0, inertLocks - 1);
    if (inertLocks === 0) {
      for (const element of inertedElements) element.removeAttribute("inert");
      inertedElements = [];
    }
  };
}

// ---------------------------------------------------------------------------
// Focus helpers
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("inert") && element.getClientRects().length > 0
  );
}

/** Keeps Tab / Shift+Tab inside `container`. Attach to its keydown. */
export function trapTabKey(event: KeyboardEvent | ReactKeyboardEvent, container: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = focusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
