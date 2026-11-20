"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { saveDraft, toSessionInput, type SessionAction } from "@/lib/workouts/session-state";
import type { SessionDTO } from "@/lib/workouts/types";

export type SyncStatus = "saved" | "saving" | "offline" | "error" | "finished_elsewhere";

const DEBOUNCE_MS = 800;
const MAX_RETRY_MS = 60_000;

/**
 * Keeps a workout in progress saved without the user doing anything:
 *  - every change is written to this device immediately (survives a reload,
 *    a killed app, no signal);
 *  - changes are sent to the server shortly after the user stops typing, and
 *    again when the connection comes back;
 *  - if the same workout was changed elsewhere, this device's copy wins.
 */
export function useSessionSync(
  session: SessionDTO,
  dispatch: (action: SessionAction) => void,
  options: { enabled: boolean; initiallyDirty: boolean }
) {
  const [status, setStatus] = useState<SyncStatus>(options.initiallyDirty ? "saving" : "saved");
  const [errorText, setErrorText] = useState<string | null>(null);

  const latest = useRef(session);
  const revision = useRef(0);
  const savedRevision = useRef(options.initiallyDirty ? -1 : 0);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(4000);
  /** True while a finish/discard request is running, or after the workout ended elsewhere. */
  const paused = useRef(false);

  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  // Runs after every render that changed the workout: the copy on this device
  // is written before anything else can happen (reload, killed app, no signal).
  useEffect(() => {
    latest.current = session;
    if (options.enabled && !paused.current && savedRevision.current !== revision.current) {
      saveDraft(session, true);
    }
  }, [session, options.enabled]);

  const schedule = useCallback((delayMs: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flushRef.current();
    }, delayMs);
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    if (!options.enabled || paused.current) return;
    if (inFlight.current) {
      await inFlight.current;
      if (savedRevision.current === revision.current) return;
    }
    if (savedRevision.current === revision.current) return;

    const run = async () => {
      const snapshot = latest.current;
      const sentRevision = revision.current;
      setStatus("saving");
      try {
        const data = await api<{ session: SessionDTO }>(`/api/sessions/${snapshot.id}`, {
          method: "PATCH",
          keepalive: typeof document !== "undefined" && document.visibilityState === "hidden",
          body: {
            version: snapshot.version,
            name: snapshot.name.trim() || "Workout",
            notes: snapshot.notes,
            exercises: toSessionInput(snapshot),
            // Only a workout typed in afterwards can change its start time.
            ...(snapshot.isPastLog ? { startedAt: snapshot.startedAt } : {}),
          },
        });
        dispatch({ type: "version", version: data.session.version });
        latest.current = { ...latest.current, version: data.session.version };
        savedRevision.current = sentRevision;
        retryDelay.current = 4000;
        setErrorText(null);
        const clean = sentRevision === revision.current;
        saveDraft(latest.current, !clean);
        setStatus(clean ? "saved" : "saving");
        if (!clean) schedule(0);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.details?.status === "completed")) {
          // Finished or discarded on another device: never overwrite that with this copy.
          paused.current = true;
          setStatus("finished_elsewhere");
          setErrorText(
            err.status === 404
              ? "This workout was discarded on another device."
              : "This workout was already finished on another device."
          );
          return;
        }
        if (err instanceof ApiError && err.status === 409) {
          // Changed elsewhere: adopt the server's version number and resend.
          const serverVersion = Number(err.details?.version);
          if (Number.isFinite(serverVersion)) {
            dispatch({ type: "version", version: serverVersion });
            latest.current = { ...latest.current, version: serverVersion };
            schedule(0);
            return;
          }
        }
        if (err instanceof ApiError && (err.offline || err.status >= 500 || err.status === 429)) {
          setStatus("offline");
          schedule(retryDelay.current);
          retryDelay.current = Math.min(MAX_RETRY_MS, retryDelay.current * 2);
          return;
        }
        setStatus("error");
        setErrorText(err instanceof ApiError ? err.message : "This workout could not be saved.");
      }
    };

    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    await inFlight.current;
  }, [dispatch, options.enabled, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Call after every change the user makes. */
  const markChanged = useCallback(() => {
    revision.current += 1;
    if (!options.enabled) return;
    setStatus((current) => (current === "offline" ? "offline" : "saving"));
    schedule(DEBOUNCE_MS);
  }, [options.enabled, schedule]);

  /**
   * Stops autosaving and waits for a request already on its way, so a late
   * autosave can never land after the workout was finished or discarded.
   */
  const pause = useCallback(async () => {
    paused.current = true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current.catch(() => undefined);
  }, []);

  /** Turns autosaving back on (the finish or discard request failed). */
  const resume = useCallback(() => {
    paused.current = false;
    if (options.enabled && savedRevision.current !== revision.current) schedule(DEBOUNCE_MS);
  }, [options.enabled, schedule]);

  /** Sends anything pending right now (before finishing or leaving). */
  const flushNow = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await flush();
  }, [flush]);

  // Unsent changes from a previous visit: send them as soon as the screen opens.
  useEffect(() => {
    if (options.enabled && options.initiallyDirty) schedule(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (!options.enabled) return;
    const onOnline = () => {
      if (savedRevision.current !== revision.current) schedule(0);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden" && savedRevision.current !== revision.current) void flushNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHidden);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [options.enabled, schedule, flushNow]);

  const hasUnsavedChanges = useCallback(() => savedRevision.current !== revision.current, []);

  return { status, errorText, markChanged, flushNow, pause, resume, hasUnsavedChanges };
}
