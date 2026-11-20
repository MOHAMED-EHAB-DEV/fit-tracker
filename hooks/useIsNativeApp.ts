import { useSyncExternalStore } from "react";
import { isAndroidNativeApp } from "@/services/webview-bridge";

const subscribe = () => () => undefined;

/**
 * True inside the Android app. Reads false during server rendering and the
 * first client render, so it never causes a hydration mismatch.
 */
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, isAndroidNativeApp, () => false);
}
