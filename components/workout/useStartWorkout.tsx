"use client";

import React, { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { clearDraft } from "@/lib/workouts/session-state";
import type { SessionDTO } from "@/lib/workouts/types";

export interface StartInput {
  routineId?: string;
  repeatSessionId?: string;
  /** Only when logging a workout that already happened. */
  startedAt?: string;
  name?: string;
}

interface Conflict {
  pending: StartInput;
  sessionId: string;
  sessionName: string;
}

/**
 * Starting a workout, from anywhere in the app. A user has one workout open
 * at a time: if one is already running, the user chooses between resuming it
 * and discarding it — it is never replaced or reused silently.
 *
 * Render `dialog` once in the component that uses the hook.
 */
export function useStartWorkout(active: { id: string; name: string } | null) {
  const router = useRouter();
  const { toast } = useToast();
  const [isNavigating, startNavigation] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    (sessionId: string) => startNavigation(() => router.push(`/workouts/session/${sessionId}`)),
    [router]
  );

  const create = useCallback(
    async (input: StartInput) => {
      const data = await api<{ session: SessionDTO }>("/api/sessions", { method: "POST", body: input });
      markDashboardStale();
      open(data.session.id);
    },
    [open]
  );

  const isBusy = busyKey !== null || isNavigating;

  const start = async (input: StartInput, key: string = "start"): Promise<void> => {
    if (isBusy) return;
    setError(null);
    if (active) {
      setConflict({ pending: input, sessionId: active.id, sessionName: active.name });
      return;
    }
    setBusyKey(key);
    try {
      await create(input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && typeof err.details?.sessionId === "string") {
        setConflict({
          pending: input,
          sessionId: err.details.sessionId,
          sessionName: typeof err.details.sessionName === "string" ? err.details.sessionName : "Workout",
        });
      } else {
        toast(errorMessage(err), "error");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const discardAndStart = async () => {
    if (!conflict || isBusy) return;
    setBusyKey("replace");
    setError(null);
    try {
      try {
        await api(`/api/sessions/${conflict.sessionId}`, { method: "DELETE" });
      } catch (err) {
        // Already gone is the outcome we wanted.
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
      clearDraft(conflict.sessionId);
      await create(conflict.pending);
      setConflict(null);
    } catch (err) {
      setError(errorMessage(err));
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  };

  const dialog = (
    <Sheet
      isOpen={Boolean(conflict)}
      onClose={() => {
        if (!isBusy) setConflict(null);
      }}
      title="You already have a workout open"
      size="md"
      closeOnBackdropClick={!isBusy}
      footer={
        <>
          <Button
            variant="danger"
            isLoading={busyKey === "replace"}
            disabled={isBusy}
            onClick={() => void discardAndStart()}
          >
            Discard it, start new
          </Button>
          <Button
            disabled={isBusy}
            onClick={() => {
              if (!conflict) return;
              const target = conflict.sessionId;
              setConflict(null);
              open(target);
            }}
          >
            Resume it
          </Button>
        </>
      }
    >
      <p className="text-sm leading-5 text-ink-2">
        &ldquo;{conflict?.sessionName}&rdquo; is not finished yet. Only one workout can be open at a time: resume it,
        or discard it to start a new one.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );

  return { start, open, busyKey, isBusy, isNavigating, dialog };
}
