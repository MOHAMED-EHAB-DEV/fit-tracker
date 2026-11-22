"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isAndroidNativeApp } from "@/services/webview-bridge";

/** The install event Chromium browsers fire; not in the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "fit_tracker_pwa_dismissed_at";
const SNOOZE_DAYS = 30;

function recentlyDismissed(): boolean {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Offers to add the site to the home screen. It only says what installing
 * actually does (opens full screen from the home screen); the app still needs
 * a connection.
 */
export function InstallPwaBanner() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isAndroidNativeApp()) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || recentlyDismissed()) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosSafari =
      /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|edgios|chrome/.test(userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only known after mount
    if (isIosSafari) setShowIosHint(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Storage unavailable: the banner is hidden for this visit only.
    }
    setIsDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "dismissed") dismiss();
  };

  // Never on top of a workout in progress.
  const hiddenHere = pathname.startsWith("/workouts/session/");
  if (isDismissed || hiddenHere || (!installEvent && !showIosHint)) return null;

  return (
    <aside
      aria-label="Add FitTracker to your home screen"
      className="fixed inset-x-0 bottom-above-nav z-30 px-3 pointer-events-none md:inset-x-auto md:end-6 md:px-0"
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Add FitTracker to your home screen</p>
          <p className="text-sm text-ink-2">
            {installEvent ? (
              "It opens full screen, like an app."
            ) : (
              <>
                Tap <Share className="mx-0.5 inline h-4 w-4 text-ink" aria-label="Share" />, then &ldquo;Add to
                Home Screen&rdquo;.
              </>
            )}
          </p>
        </div>
        {installEvent && (
          <Button size="sm" startContent={<Download className="h-4 w-4" />} onClick={() => void install()}>
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-2 active:bg-elevated cursor-pointer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export default InstallPwaBanner;
