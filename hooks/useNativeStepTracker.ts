"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { localDateString, resolveTimeZone } from "@/lib/time";
import {
  NATIVE_STEPS_EVENT,
  getAndroidBridge,
  syncNativeUserContext,
  type NativeSensorInfo,
  type NativeStepEventDetail,
  type NativeStepSnapshot,
  type NativeStepStatus,
} from "@/services/webview-bridge";

export type StepSensorInfo = NativeSensorInfo;

/** How long the sync spinner waits for the app's answer before giving up. */
const NATIVE_SYNC_TIMEOUT_MS = 8000;

interface StepTrackerState {
  isNative: boolean;
  /** The app's sensor total for the user's today, or null when it has none. */
  nativeSteps: number | null;
  sensorInfo: StepSensorInfo | null;
  status: NativeStepStatus | null;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
}

function parseSensorInfo(raw: unknown): StepSensorInfo | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StepSensorInfo>;
    if (typeof parsed?.name !== "string") return null;
    return {
      name: parsed.name,
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : "",
      version: Number(parsed.version) || 0,
      powerMa: Number(parsed.powerMa) || 0,
      type: parsed.type === "STEP_COUNTER" ? "STEP_COUNTER" : "NONE",
      isWakeUp: Boolean(parsed.isWakeUp),
      supported: parsed.supported !== false && parsed.type === "STEP_COUNTER",
      permission:
        parsed.permission === "denied" || parsed.permission === "not_required" ? parsed.permission : "granted",
    };
  } catch {
    return null;
  }
}

function parseSnapshot(raw: unknown): NativeStepSnapshot | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NativeStepSnapshot>;
    if (typeof parsed?.steps !== "number" || typeof parsed.date !== "string") return null;
    return parsed as NativeStepSnapshot;
  } catch {
    return null;
  }
}

/**
 * Step count from the Android app's pedometer (for the user's today, in their
 * time zone). On the web it falls back to the server's stored value.
 */
export function useNativeStepTracker(initialSteps: number = 0) {
  const { user, timezone } = useUser();
  const timeZone = resolveTimeZone(timezone);

  const [state, setState] = useState<StepTrackerState>({
    isNative: false,
    nativeSteps: null,
    sensorInfo: null,
    status: null,
    isSyncing: false,
    lastSyncedAt: null,
    syncError: null,
  });

  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const requestCounterRef = useRef(0);

  const finishSync = useCallback((error: string | null) => {
    isSyncingRef.current = false;
    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setState((prev) => ({ ...prev, isSyncing: false, syncError: error }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = getAndroidBridge();
    let isNative = false;
    try {
      isNative = Boolean(bridge?.isNativeApp?.());
    } catch {
      isNative = false;
    }
    if (!isNative || !bridge) return;

    // The user's zone is the app's day boundary for steps.
    if (user) syncNativeUserContext(timeZone);

    const today = localDateString(new Date(), timeZone);
    let sensorInfo: StepSensorInfo | null = null;
    let nativeSteps: number | null = null;
    let status: NativeStepStatus | null = null;
    try {
      sensorInfo = parseSensorInfo(bridge.getSensorInfo?.());
      const snapshot = parseSnapshot(bridge.getStepSnapshot?.());
      if (snapshot) {
        status = snapshot.status;
        if (snapshot.date === today) nativeSteps = snapshot.steps;
      } else if (bridge.getTodaySteps) {
        const cached = Number(bridge.getTodaySteps());
        if (Number.isFinite(cached) && cached >= 0) nativeSteps = cached;
      }
    } catch (err) {
      console.warn("Failed to read steps from the app:", err);
    }

    // Reading the bridge once on mount is an external-system sync, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({ ...prev, isNative: true, sensorInfo, nativeSteps, status }));

    const handleStepEvent = (event: Event) => {
      const detail = (event as CustomEvent<NativeStepEventDetail>).detail;
      if (!detail || typeof detail.steps !== "number" || !Number.isFinite(detail.steps)) return;
      const currentDay = localDateString(new Date(), timeZone);
      const forToday = !detail.date || detail.date === currentDay;
      setState((prev) => ({
        ...prev,
        nativeSteps: forToday ? detail.steps : prev.nativeSteps,
        status: detail.status ?? prev.status,
        lastSyncedAt: detail.reason === "sync" || detail.reason === "live" ? new Date() : prev.lastSyncedAt,
      }));
      if (detail.reason === "sync" && isSyncingRef.current) {
        finishSync(
          detail.status === "permission_denied"
            ? "Allow physical activity access to count steps."
            : detail.status === "unsupported"
              ? "This phone has no step counter."
              : null
        );
      }
    };

    window.addEventListener(NATIVE_STEPS_EVENT, handleStepEvent);
    return () => {
      window.removeEventListener(NATIVE_STEPS_EVENT, handleStepEvent);
    };
  }, [user, timeZone, finishSync]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current !== null) window.clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  /** Asks the app for a fresh sensor reading (or reloads the server value on the web). */
  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setState((prev) => ({ ...prev, isSyncing: true, syncError: null }));

    const bridge = getAndroidBridge();
    if (bridge?.requestStepSync) {
      syncTimeoutRef.current = window.setTimeout(() => {
        syncTimeoutRef.current = null;
        finishSync("The step counter did not answer. Try again in a moment.");
      }, NATIVE_SYNC_TIMEOUT_MS);
      try {
        bridge.requestStepSync();
      } catch {
        finishSync("Could not reach the step counter.");
      }
      return;
    }

    const requestId = ++requestCounterRef.current;
    try {
      const res = await fetch("/api/steps/sync", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { success?: boolean; steps?: unknown } | null;
      if (requestId !== requestCounterRef.current) return;
      if (!res.ok || !data?.success || typeof data.steps !== "number") {
        finishSync("Could not refresh steps.");
        return;
      }
      const steps = data.steps;
      setState((prev) => ({ ...prev, nativeSteps: steps, lastSyncedAt: new Date() }));
      finishSync(null);
    } catch {
      if (requestId === requestCounterRef.current) finishSync("Could not refresh steps.");
    }
  }, [finishSync]);

  return {
    isNative: state.isNative,
    steps: state.nativeSteps ?? initialSteps,
    /** The app's own sensor total for today (null on the web or when it has none). */
    nativeSteps: state.isNative ? state.nativeSteps : null,
    sensorInfo: state.sensorInfo,
    status: state.status,
    isSyncing: state.isSyncing,
    syncError: state.syncError,
    lastSyncedAt: state.lastSyncedAt,
    syncNow,
  };
}
