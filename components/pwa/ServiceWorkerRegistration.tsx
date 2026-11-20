"use client";

import { useEffect } from "react";
import { isAndroidNativeApp } from "@/services/webview-bridge";

/**
 * Registers the offline-page service worker (production builds, browsers
 * only). The Android app shows its own offline screen, so it is skipped there.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || isAndroidNativeApp()) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Not fatal: the app works without the offline page.
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

export default ServiceWorkerRegistration;
