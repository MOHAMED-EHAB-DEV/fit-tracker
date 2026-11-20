import { notifyNativeLogout } from "@/services/webview-bridge";

/** Prefixes of everything this app keeps in the browser for a signed-in user. */
const USER_STORAGE_PREFIXES = ["ft:", "fit-tracker:coach:"];

/**
 * Signs the user out everywhere this device keeps state: the session cookie,
 * locally saved drafts and chat history, and (inside the Android app)
 * widgets, reminders and step data.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // Even if the request fails we still leave the signed-in area; the
    // login page clears a stale cookie.
  }

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (USER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable (private mode); nothing to clear then.
  }

  notifyNativeLogout();

  // A full page load on purpose: it drops every piece of in-memory state of the signed-in app.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation on logout
  window.location.assign("/login?expired=1");
}
