"use client";

import { useEffect, useState } from "react";
import { localDateString, localParts } from "@/lib/time";

function snapshot(timeZone: string) {
  const now = new Date();
  const parts = localParts(now, timeZone);
  return {
    today: localDateString(now, timeZone),
    time: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

/**
 * The user's current date and HH:MM in their zone. Refreshes every 30 s and
 * whenever the app comes back to the foreground, so an app left open past
 * midnight moves to the new day.
 */
export function useToday(timeZone: string, initialToday: string): { today: string; time: string } {
  const [state, setState] = useState(() => ({ today: initialToday, time: "" }));

  useEffect(() => {
    const update = () =>
      setState((prev) => {
        const next = snapshot(timeZone);
        return prev.today === next.today && prev.time === next.time ? prev : next;
      });
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", update);
    };
  }, [timeZone]);

  return state;
}
