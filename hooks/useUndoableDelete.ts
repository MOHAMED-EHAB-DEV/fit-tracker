"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export interface UndoableDeleteOptions<T> {
  /** Stable id of an item. */
  getId: (item: T) => string;
  /**
   * Deletes for real. Runs when the undo window ends, or at once when the page
   * is hidden or the screen goes away. Use `keepalive: true` on its request so
   * it survives the page closing.
   */
  commit: (item: T) => Promise<unknown>;
  /** Toast text, e.g. "Meal deleted". */
  message: (item: T) => string;
  /** The deletion failed: the item is shown again; tell the user. */
  onError?: (item: T, error: unknown) => void;
  /** Undo window. 7 seconds by default. */
  delayMs?: number;
}

export interface UndoableDelete<T> {
  /** Ids to leave out of the list: waiting for the undo window, or deleted. */
  hiddenIds: ReadonlySet<string>;
  isHidden: (id: string) => boolean;
  /** Hides the item at once and offers Undo for the undo window. */
  remove: (item: T) => void;
  undo: (id: string) => void;
  /** Deletes everything still waiting, now. */
  flush: () => void;
}

interface PendingEntry<T> {
  item: T;
  timer: ReturnType<typeof setTimeout>;
  toastId: string;
}

/**
 * Reversible deletes: the item disappears at once, an Undo toast stays in the
 * thumb zone for 7 seconds, and only then is it deleted on the server. Leaving
 * the screen or hiding the page deletes immediately, so nothing is lost.
 */
export function useUndoableDelete<T>(options: UndoableDeleteOptions<T>): UndoableDelete<T> {
  const { toast, dismiss } = useToast();
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const pending = useRef(new Map<string, PendingEntry<T>>());
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const show = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const commitNow = useCallback(
    (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(id);
      dismiss(entry.toastId);
      const { commit, onError } = optionsRef.current;
      commit(entry.item).catch((error: unknown) => {
        show(id);
        onError?.(entry.item, error);
      });
    },
    [dismiss, show]
  );

  const undo = useCallback(
    (id: string) => {
      const entry = pending.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(id);
      dismiss(entry.toastId);
      show(id);
    },
    [dismiss, show]
  );

  const remove = useCallback(
    (item: T) => {
      const { getId, message, delayMs = 7000 } = optionsRef.current;
      const id = getId(item);
      if (pending.current.has(id)) return;
      setHiddenIds((prev) => new Set(prev).add(id));
      const toastId = toast(message(item), "info", {
        duration: delayMs,
        action: { label: "Undo", onClick: () => undo(id) },
      });
      const timer = setTimeout(() => commitNow(id), delayMs);
      pending.current.set(id, { item, timer, toastId });
    },
    [toast, undo, commitNow]
  );

  const flush = useCallback(() => {
    for (const id of Array.from(pending.current.keys())) commitNow(id);
  }, [commitNow]);

  // Hiding the page or leaving the screen ends the undo window.
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds]);

  return { hiddenIds, isHidden, remove, undo, flush };
}

export default useUndoableDelete;
