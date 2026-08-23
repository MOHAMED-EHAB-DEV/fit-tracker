"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StepSensorInfo {
  name: string;
  vendor: string;
  version: number;
  powerMa: number;
  type: string;
  isWakeUp: boolean;
}

interface StepTrackerState {
  isNative: boolean;
  nativeSteps: number | null;
  sensorInfo: StepSensorInfo | null;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
}

declare global {
  interface Window {
    AndroidBridge?: {
      isNativeApp?: () => boolean;
      getTodaySteps?: () => number;
      getSensorInfo?: () => string;
      requestStepSync?: () => void;
      setAuthToken?: (token: string) => void;
      setServerUrl?: (url: string) => void;
    };
    __fitBridge?: {
      onStepUpdate?: (steps: number) => void;
    };
  }
}

export function useNativeStepTracker(initialSteps: number = 0) {
  const [state, setState] = useState<StepTrackerState>({
    isNative: false,
    nativeSteps: initialSteps,
    sensorInfo: null,
    isSyncing: false,
    lastSyncedAt: null,
  });

  const isSyncingRef = useRef(false);

  // Synchronize on-mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const bridge = window.AndroidBridge;
    const isNative = Boolean(bridge && bridge.isNativeApp?.());

    let sensorInfo: StepSensorInfo | null = null;
    let initialCount = initialSteps;

    if (isNative && bridge) {
      try {
        // 1. Tell Android native the current origin URL
        if (bridge.setServerUrl) {
          bridge.setServerUrl(window.location.origin);
        }

        // 2. Read initial cached steps from Android StepStore
        if (bridge.getTodaySteps) {
          const cached = Number(bridge.getTodaySteps());
          if (!isNaN(cached) && cached > 0) {
            initialCount = Math.max(initialCount, cached);
          }
        }

        // 3. Parse sensor hardware metadata
        if (bridge.getSensorInfo) {
          const raw = bridge.getSensorInfo();
          if (raw) {
            sensorInfo = JSON.parse(raw);
          }
        }
      } catch (err) {
        console.warn("Failed to initialize AndroidBridge:", err);
      }
    }

    setState((prev) => ({
      ...prev,
      isNative,
      nativeSteps: initialCount,
      sensorInfo,
    }));

    // Step update event listener
    const handleStepEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ steps: number; timestamp?: number }>;
      const steps = customEvent.detail?.steps;
      if (typeof steps === "number" && !isNaN(steps)) {
        setState((prev) => ({
          ...prev,
          nativeSteps: Math.max(prev.nativeSteps || 0, steps),
          lastSyncedAt: new Date(),
          isSyncing: false,
        }));
      }
    };

    window.addEventListener("fit-tracker-steps-update", handleStepEvent);

    // Global __fitBridge callback
    window.__fitBridge = {
      onStepUpdate: (steps: number) => {
        if (typeof steps === "number" && !isNaN(steps)) {
          setState((prev) => ({
            ...prev,
            nativeSteps: Math.max(prev.nativeSteps || 0, steps),
            lastSyncedAt: new Date(),
            isSyncing: false,
          }));
        }
      },
    };

    return () => {
      window.removeEventListener("fit-tracker-steps-update", handleStepEvent);
    };
  }, [initialSteps]);

  // Request on-demand step refresh
  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setState((prev) => ({ ...prev, isSyncing: true }));

    const bridge = typeof window !== "undefined" ? window.AndroidBridge : undefined;

    if (bridge && typeof bridge.requestStepSync === "function") {
      bridge.requestStepSync();
      // Allow 1.5 seconds for native thread to respond
      setTimeout(() => {
        isSyncingRef.current = false;
        setState((prev) => ({ ...prev, isSyncing: false }));
      }, 1500);
    } else {
      // Fallback web sync from API
      try {
        const res = await fetch("/api/steps/sync");
        if (res.ok) {
          const data = await res.json();
          if (data.success && typeof data.steps === "number") {
            setState((prev) => ({
              ...prev,
              nativeSteps: data.steps,
              lastSyncedAt: new Date(),
            }));
          }
        }
      } catch (err) {
        console.error("Step sync fetch failed:", err);
      } finally {
        isSyncingRef.current = false;
        setState((prev) => ({ ...prev, isSyncing: false }));
      }
    }
  }, []);

  return {
    isNative: state.isNative,
    steps: state.nativeSteps !== null ? state.nativeSteps : initialSteps,
    sensorInfo: state.sensorInfo,
    isSyncing: state.isSyncing,
    lastSyncedAt: state.lastSyncedAt,
    syncNow,
  };
}
