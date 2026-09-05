"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share2, PlusSquare, Sparkles } from "lucide-react";
import { isAndroidNativeApp } from "@/services/webview-bridge";

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Don't show in native Android app wrapper
    if (isAndroidNativeApp()) return;

    // 2. Don't show if already installed in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // 3. Don't show if previously dismissed within 7 days
    const dismissedAt = localStorage.getItem("fit_tracker_pwa_dismissed_at");
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // 4. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari =
      isAppleDevice &&
      !userAgent.includes("crios") &&
      !userAgent.includes("fxios") &&
      !userAgent.includes("chrome");

    if (isAppleDevice && isSafari) {
      setIsIOS(true);
      setShowBanner(true);
      return;
    }

    // 5. Chromium beforeinstallprompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("fit_tracker_pwa_dismissed_at", Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <aside
      aria-label="Install FitTracker App"
      className="fixed bottom-20 md:bottom-6 inset-s-4 inset-e-4 md:inset-s-auto md:inset-e-6 z-50 max-w-md p-4 rounded-2xl bg-zinc-900/95 border border-emerald-500/30 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 text-zinc-950 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-white text-xs tracking-tight">
                Install FitTracker App
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                Fast & Offline
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              {isIOS ? (
                <span>
                  Tap <Share2 className="w-3 h-3 inline mx-0.5 text-zinc-300" /> Share then select{" "}
                  <strong className="text-zinc-200">
                    &apos;Add to Home Screen&apos; <PlusSquare className="w-3 h-3 inline mx-0.5" />
                  </strong>{" "}
                  for fullscreen access.
                </span>
              ) : (
                <span>
                  Install to your home screen for instant fullscreen logging and live widgets. Zero app store fees.
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-400 hover:text-zinc-200 transition p-1 rounded-lg hover:bg-zinc-800"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install Now</span>
          </button>
        </div>
      )}
    </aside>
  );
}
