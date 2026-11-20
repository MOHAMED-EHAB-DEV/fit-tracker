"use client";

import { useCallback, useRef, useState } from "react";
import { applyToggle } from "@/lib/habits/completion";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, requestJson } from "./api";

export type LogsMap = Record<string, string[]>;

const pendingKey = (dateString: string, habitId: string) => `${dateString}:${habitId}`;

/**
 * Habit completion state per day with race-free toggles:
 *  - one request at a time per (day, habit); repeat taps are ignored while pending,
 *  - updates touch only the toggled id (other in-flight toggles are untouched),
 *  - a failure reverts only that id and shows an error toast,
 *  - server range loads never overwrite a day changed after the load started.
 */
export function useHabitLogs(initial: LogsMap) {
  const { toast } = useToast();
  const [logsMap, setLogsMap] = useState<LogsMap>(initial);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const pendingRef = useRef(new Set<string>());
  const seqRef = useRef(0);
  const touchedRef = useRef(new Map<string, number>());

  const isPending = useCallback(
    (dateString: string, habitId: string) => pending.has(pendingKey(dateString, habitId)),
    [pending]
  );

  const hasPending = pending.size > 0;

  /** Current sequence number; pass it to `mergeServerLogs` for a load started now. */
  const snapshotSeq = useCallback(() => seqRef.current, []);

  const mergeServerLogs = useCallback((entries: LogsMap, startedAtSeq: number) => {
    setLogsMap((prev) => {
      const next = { ...prev };
      for (const [dateString, ids] of Object.entries(entries)) {
        const touched = touchedRef.current.get(dateString) ?? 0;
        if (touched > startedAtSeq) continue;
        next[dateString] = ids;
      }
      return next;
    });
  }, []);

  /** Replaces one day from an authoritative source (e.g. a fresh server render). */
  const setDay = useCallback((dateString: string, ids: string[]) => {
    if (Array.from(pendingRef.current).some((key) => key.startsWith(`${dateString}:`))) return;
    setLogsMap((prev) => ({ ...prev, [dateString]: ids }));
  }, []);

  /** Returns true when the server confirmed the change. */
  const toggle = useCallback(
    async (habitId: string, dateString: string, checked: boolean): Promise<boolean> => {
      const key = pendingKey(dateString, habitId);
      if (pendingRef.current.has(key)) return false;
      pendingRef.current.add(key);
      setPending(new Set(pendingRef.current));
      touchedRef.current.set(dateString, ++seqRef.current);
      setLogsMap((prev) => ({ ...prev, [dateString]: applyToggle(prev[dateString], habitId, checked) }));

      let confirmed = false;
      try {
        await requestJson("/api/habits/log", {
          method: "POST",
          body: JSON.stringify({ habitId, dateString, action: checked ? "check" : "uncheck" }),
        });
        confirmed = true;
      } catch (err) {
        setLogsMap((prev) => ({ ...prev, [dateString]: applyToggle(prev[dateString], habitId, !checked) }));
        toast(errorMessage(err, "Could not save the habit. Please try again."), "error");
      } finally {
        touchedRef.current.set(dateString, ++seqRef.current);
        pendingRef.current.delete(key);
        setPending(new Set(pendingRef.current));
      }
      return confirmed;
    },
    [toast]
  );

  return { logsMap, toggle, isPending, hasPending, mergeServerLogs, snapshotSeq, setDay };
}
