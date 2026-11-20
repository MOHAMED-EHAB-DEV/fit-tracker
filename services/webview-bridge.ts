/**
 * Web side of the Android WebView bridge (`window.AndroidBridge`).
 *
 * Every helper is safe to call on the web: without the native bridge it does
 * nothing (or uses the browser equivalent). Keep this interface in sync with
 * FitTrackerAndroid/app/src/main/java/com/fittracker/webview/JSBridge.kt.
 * Native methods answer only when the page is on the app's own origin.
 */

export interface AndroidBridgeInterface {
  isNativeApp?: () => boolean;
  /** JSON: {"versionName":"2.1.0","versionCode":12,"buildType":"release"} */
  getAppVersion?: () => string;
  getTodaySteps?: () => number;
  /** JSON NativeStepSnapshot. */
  getStepSnapshot?: () => string;
  /** JSON NativeSensorInfo. */
  getSensorInfo?: () => string;
  /** Reads the sensor (asking for permission in context if needed); answers with a step event. */
  requestStepSync?: () => void;
  /** JSON {"timeZone":"Africa/Cairo"}: the signed-in user's zone (day boundary for steps). */
  setUserContext?: (json: string) => void;
  /** Wipes all native per-user state (steps, widgets, reminders). Call on logout. */
  clearUserData?: () => void;
  setServerUrl?: (url: string) => void;
  checkForUpdate?: () => void;
  openExternalUrl?: (url: string) => boolean;
  updateWidgetData?: (json: string) => void;
  pinWidget?: (type: string) => boolean;
  isPinWidgetSupported?: () => boolean;
  showNotification?: (eventId: string, title: string, description: string, category: string) => void;
  /** JSON {"reminders":[...]} -> JSON NativeReminderStatus. */
  setPlannerReminders?: (json: string) => string;
  getReminderStatus?: () => string;
  openNotificationSettings?: () => void;
  openExactAlarmSettings?: () => void;
  openAppSettings?: () => void;
  /** Saves base64 file content through the system "Save as" dialog. */
  saveFile?: (base64: string, filename: string, mimeType: string) => boolean;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
  }
}

/** Name of the DOM event the native app dispatches with step updates. */
export const NATIVE_STEPS_EVENT = "fit-tracker-steps-update";

export type NativeStepStatus = "ok" | "permission_needed" | "permission_denied" | "unsupported" | "no_reading";

/** `detail` of the NATIVE_STEPS_EVENT. */
export interface NativeStepEventDetail {
  steps: number;
  /** Calendar day ("YYYY-MM-DD", user's zone) the steps belong to. */
  date?: string;
  timestamp?: number;
  /** "live" (sensor while the app is open), "sync" (answer to requestStepSync) or "cache". */
  reason?: "live" | "sync" | "cache";
  status?: NativeStepStatus;
}

export interface NativeStepSnapshot {
  steps: number;
  date: string;
  timeZone: string;
  lastReadingAt: number;
  status: NativeStepStatus;
}

export interface NativeSensorInfo {
  name: string;
  vendor: string;
  version: number;
  powerMa: number;
  type: "STEP_COUNTER" | "NONE";
  isWakeUp: boolean;
  supported: boolean;
  permission: "granted" | "denied" | "not_required";
}

export interface NativeAppVersion {
  versionName: string;
  versionCode: number;
  buildType: string;
}

export interface NativeReminderStatus {
  ok: boolean;
  scheduled: number;
  notificationsAllowed: boolean;
  exactAlarmsAllowed: boolean;
  error?: string;
}

/** True inside the FitTracker Android app. */
export function isAndroidNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.AndroidBridge?.isNativeApp?.());
  } catch {
    return false;
  }
}

export function getAndroidBridge(): AndroidBridgeInterface | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AndroidBridge;
}

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Opens a link in the system browser (in the app) or a new tab (on the web). */
export function openExternalLink(url: string): void {
  if (typeof window === "undefined") return;
  const bridge = getAndroidBridge();
  if (bridge?.openExternalUrl) {
    try {
      if (bridge.openExternalUrl(url)) return;
    } catch {
      // fall through to the browser behaviour
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export const ANDROID_RELEASES_URL = "https://github.com/MOHAMED-EHAB-DEV/fit-tracker/releases/latest";

/** In the app: native update check (shows its own result). On the web: opens the releases page. */
export function triggerAppUpdateCheck(): void {
  if (typeof window === "undefined") return;
  const bridge = getAndroidBridge();
  if (bridge?.checkForUpdate) {
    bridge.checkForUpdate();
  } else {
    openExternalLink(ANDROID_RELEASES_URL);
  }
}

/** The installed Android app's version, or null on the web / older app builds. */
export function getNativeAppVersion(): NativeAppVersion | null {
  const bridge = getAndroidBridge();
  if (!bridge?.getAppVersion) return null;
  try {
    const parsed = parseJson<Partial<NativeAppVersion>>(bridge.getAppVersion());
    if (!parsed || typeof parsed.versionName !== "string" || typeof parsed.versionCode !== "number") return null;
    return {
      versionName: parsed.versionName,
      versionCode: parsed.versionCode,
      buildType: typeof parsed.buildType === "string" ? parsed.buildType : "release",
    };
  } catch {
    return null;
  }
}

/**
 * Tells the app the signed-in user's IANA time zone (the day boundary for
 * steps) and that a session exists. Call once the user is known.
 */
export function syncNativeUserContext(timeZone: string): void {
  const bridge = getAndroidBridge();
  if (!bridge?.setUserContext) return;
  try {
    bridge.setUserContext(JSON.stringify({ timeZone }));
  } catch (err) {
    console.warn("Failed to send user context to the app:", err);
  }
}

/**
 * Clears everything the Android app keeps for the signed-in user (step
 * history, widget numbers, scheduled reminders). Call it on logout, before
 * or right after the logout request. No-op on the web.
 */
export function notifyNativeLogout(): void {
  const bridge = getAndroidBridge();
  if (!bridge?.clearUserData) return;
  try {
    bridge.clearUserData();
  } catch (err) {
    console.warn("Failed to clear the app's user data:", err);
  }
}

export interface WidgetSyncData {
  /**
   * Day ("YYYY-MM-DD", user's zone) these numbers belong to. When omitted the
   * app stamps the data with its own current day (same zone, see syncNativeUserContext).
   */
  date?: string;
  steps?: number;
  stepGoal?: number;
  caloriesIn?: number;
  targetCalories?: number;
  waterMl?: number;
  waterGoalMl?: number;
  streakDays?: number;
  longestStreak?: number;
  isLoggedToday?: boolean;
}

/**
 * Sends the server's numbers for a day to the Android home screen widgets.
 * `steps` should be the SERVER's stored steps: the app shows the higher of
 * this and its own sensor total for the same day.
 */
export function syncWidgetData(data: WidgetSyncData): void {
  const bridge = getAndroidBridge();
  if (!bridge?.updateWidgetData) return;
  try {
    bridge.updateWidgetData(JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to sync widget data:", err);
  }
}

export function isPinAppWidgetSupported(): boolean {
  const bridge = getAndroidBridge();
  try {
    return Boolean(bridge?.isPinWidgetSupported?.());
  } catch {
    return false;
  }
}

/** Asks the launcher to add a widget. True when the launcher's dialog was shown. */
export function requestPinAppWidget(type: "small" | "medium" | "large"): boolean {
  const bridge = getAndroidBridge();
  if (!bridge?.pinWidget) return false;
  try {
    return Boolean(bridge.pinWidget(type));
  } catch {
    return false;
  }
}

export interface PlannerNotificationPayload {
  id: string;
  title: string;
  description?: string;
  category?: string;
}

/** Shows a planner notification right now (Android only). */
export function triggerSystemNotification(payload: PlannerNotificationPayload): void {
  const bridge = getAndroidBridge();
  if (!bridge?.showNotification) return;
  try {
    bridge.showNotification(payload.id, payload.title, payload.description || "", payload.category || "other");
  } catch (err) {
    console.warn("Failed to trigger system notification:", err);
  }
}

/** Hands the reminder schedule to the app; null on the web or older app builds. */
export function scheduleNativeReminders(reminders: readonly unknown[]): NativeReminderStatus | null {
  const bridge = getAndroidBridge();
  if (!bridge?.setPlannerReminders) return null;
  try {
    return parseJson<NativeReminderStatus>(bridge.setPlannerReminders(JSON.stringify({ reminders })));
  } catch (err) {
    console.warn("Failed to schedule reminders:", err);
    return null;
  }
}

export function getNativeReminderStatus(): NativeReminderStatus | null {
  const bridge = getAndroidBridge();
  if (!bridge?.getReminderStatus) return null;
  try {
    return parseJson<NativeReminderStatus>(bridge.getReminderStatus());
  } catch {
    return null;
  }
}

export function openNativeNotificationSettings(): void {
  getAndroidBridge()?.openNotificationSettings?.();
}

export function openNativeExactAlarmSettings(): void {
  getAndroidBridge()?.openExactAlarmSettings?.();
}

export function openNativeAppSettings(): void {
  getAndroidBridge()?.openAppSettings?.();
}

/** Largest file the app accepts over the bridge (bytes). */
export const MAX_NATIVE_FILE_BYTES = 20 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the file"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves a generated file. In the Android app (where `<a download>` does not
 * work) it opens the system "Save as" dialog; on the web it downloads.
 * Resolves false when the file could not be handed over.
 */
export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = getAndroidBridge();
  if (bridge?.saveFile) {
    if (blob.size > MAX_NATIVE_FILE_BYTES) return false;
    try {
      const base64 = await blobToBase64(blob);
      return Boolean(bridge.saveFile(base64, filename, blob.type || "application/octet-stream"));
    } catch (err) {
      console.warn("Failed to hand the file to the app:", err);
      return false;
    }
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke later: some browsers start the download asynchronously.
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  return true;
}
