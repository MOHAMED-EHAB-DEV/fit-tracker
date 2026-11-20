"use client";

import { useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { syncPlannerReminders } from "@/services/planner-reminders";
import { syncNativeUserContext } from "@/services/webview-bridge";

/**
 * Things that must happen when the signed-in app opens or comes back to the
 * foreground. Inside the Android app: tell it the user's time zone (the day
 * boundary for steps) and refresh the scheduled planner reminders. On the web
 * both calls do nothing.
 */
export function AppLifecycle() {
  const { timezone } = useUser();

  useEffect(() => {
    syncNativeUserContext(timezone);
    void syncPlannerReminders();

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (Date.now() - hiddenAt > 5 * 60_000) {
        void syncPlannerReminders();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [timezone]);

  return null;
}

export default AppLifecycle;
