import {
  getAndroidBridge,
  scheduleNativeReminders,
  type NativeReminderStatus,
} from "@/services/webview-bridge";

/**
 * Keeps the Android app's scheduled planner reminders in step with the
 * server. Safe to call anywhere on the client: on the web (no native bridge)
 * it does nothing.
 *
 * Call it when the app opens and after any planner change (create, edit,
 * complete, delete). The app also refreshes the schedule by itself every few
 * hours and after a reboot, time change or time-zone change.
 */

export type PlannerReminderSyncResult =
  | { status: "unsupported" }
  | { status: "signed_out" }
  | { status: "error"; message: string }
  | { status: "scheduled"; native: NativeReminderStatus };

let inFlight: Promise<PlannerReminderSyncResult> | null = null;
let rerunRequested = false;

async function runSync(): Promise<PlannerReminderSyncResult> {
  let response: Response;
  try {
    response = await fetch("/api/planner/upcoming", { cache: "no-store", credentials: "same-origin" });
  } catch {
    return { status: "error", message: "Could not reach the server to refresh reminders." };
  }
  if (response.status === 401) return { status: "signed_out" };

  const payload = (await response.json().catch(() => null)) as { success?: boolean; reminders?: unknown } | null;
  if (!response.ok || !payload?.success || !Array.isArray(payload.reminders)) {
    return { status: "error", message: "Could not load upcoming reminders." };
  }

  const native = scheduleNativeReminders(payload.reminders);
  if (!native) return { status: "error", message: "The app could not schedule reminders." };
  if (!native.ok) return { status: "error", message: native.error || "The app could not schedule reminders." };
  return { status: "scheduled", native };
}

export async function syncPlannerReminders(): Promise<PlannerReminderSyncResult> {
  if (typeof window === "undefined" || !getAndroidBridge()?.setPlannerReminders) {
    return { status: "unsupported" };
  }

  // Single flight: a change made while a sync runs triggers exactly one more run.
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }

  inFlight = (async () => {
    let result: PlannerReminderSyncResult;
    do {
      rerunRequested = false;
      result = await runSync();
    } while (rerunRequested);
    return result;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
