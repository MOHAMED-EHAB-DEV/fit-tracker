/**
 * Centralized Android WebView Bridge Service
 * Handles hardware back-button interception, native step tracking communication,
 * OTA update checks, and external system browser routing.
 */

export interface AndroidBridgeInterface {
  isNativeApp?: () => boolean;
  getTodaySteps?: () => number;
  getSensorInfo?: () => string;
  requestStepSync?: () => void;
  setAuthToken?: (token: string) => void;
  setServerUrl?: (url: string) => void;
  checkForUpdate?: () => void;
  openExternalUrl?: (url: string) => void;
  updateWidgetData?: (json: string) => void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    __fitBridge?: {
      onStepUpdate?: (steps: number) => void;
    };
  }
}

/**
 * Checks whether the application is currently executing inside the native Android WebView wrapper.
 */
export function isAndroidNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.AndroidBridge && window.AndroidBridge.isNativeApp?.());
}

/**
 * Retrieves the Android Bridge object if available.
 */
export function getAndroidBridge(): AndroidBridgeInterface | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AndroidBridge;
}

/**
 * Intercepts the Android hardware back button / edge swipe gesture for overlays.
 * Returns a cleanup function that must be called when the overlay unmounts.
 */
export function registerBackButtonInterceptor(onBack: () => boolean): () => void {
  if (typeof window === "undefined") return () => {};

  const historyStateKey = `dialog_state_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  window.history.pushState({ [historyStateKey]: true }, "");

  let isClosedByPop = false;

  const handlePopState = () => {
    isClosedByPop = true;
    const handled = onBack();
    if (!handled && window.history.state?.[historyStateKey]) {
      window.history.back();
    }
  };

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
    if (!isClosedByPop && window.history.state?.[historyStateKey]) {
      window.history.back();
    }
  };
}

/**
 * Safely opens an external link in the system default browser rather than trapping the user in the WebView.
 */
export function openExternalLink(url: string): void {
  if (typeof window === "undefined") return;

  const bridge = getAndroidBridge();
  if (bridge?.openExternalUrl) {
    bridge.openExternalUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Triggers an over-the-air native app update check.
 */
export function triggerAppUpdateCheck(): void {
  if (typeof window === "undefined") return;

  const bridge = getAndroidBridge();
  if (bridge?.checkForUpdate) {
    bridge.checkForUpdate();
  } else {
    openExternalLink("https://github.com/MOHAMED-EHAB-DEV/fit-tracker/releases/latest");
  }
}

export interface WidgetSyncData {
  steps?: number;
  stepGoal?: number;
  caloriesIn?: number;
  targetCalories?: number;
  waterMl?: number;
  waterGoalMl?: number;
}

/**
 * Synchronizes daily fitness metrics with native Android home screen widgets.
 */
export function syncWidgetData(data: WidgetSyncData): void {
  if (typeof window === "undefined") return;

  const bridge = getAndroidBridge();
  if (bridge?.updateWidgetData) {
    try {
      bridge.updateWidgetData(JSON.stringify(data));
    } catch (err) {
      console.warn("Failed to sync widget data:", err);
    }
  }
}

