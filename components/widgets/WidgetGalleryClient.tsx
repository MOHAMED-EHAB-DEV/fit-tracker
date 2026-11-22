"use client";

import React, { useState, useEffect } from "react";
import { Smartphone, Check, Flame, Footprints, Plus, RefreshCw, Info, ExternalLink } from "lucide-react";
import { buttonClasses } from "@/components/ui/button-styles";
import {
  ANDROID_RELEASES_URL,
  isAndroidNativeApp,
  isPinAppWidgetSupported,
  requestPinAppWidget,
  openExternalLink,
} from "@/services/webview-bridge";

type WidgetId = "small" | "medium" | "large";

interface WidgetInfo {
  id: WidgetId;
  name: string;
  gridSize: string;
  description: string;
  features: string[];
}

// Keep in sync with FitTrackerAndroid/app/src/main/res/layout/widget_*.xml.
const WIDGETS_LIST: WidgetInfo[] = [
  {
    id: "small",
    name: "Quick Step Counter",
    gridSize: "2 × 2",
    description: "Today's steps, progress toward your step goal and the walked distance.",
    features: ["Today's step count", "Goal progress bar", "Estimated distance", "Tap to open the app"],
  },
  {
    id: "medium",
    name: "Activity & Steps",
    gridSize: "4 × 2",
    description: "Steps with goal progress, distance, calories burned by walking and a Sync button.",
    features: [
      "Step goal progress bar",
      "Distance and walking calories",
      "Sync button: reads the step sensor and uploads",
      "Shows when it last synced",
    ],
  },
  {
    id: "large",
    name: "Daily Fitness Overview",
    gridSize: "4 × 3",
    description: "Steps, calories eaten against your target, water and your habit streak for today.",
    features: [
      "Steps and goal progress",
      "Calories eaten vs. daily target",
      "Water intake vs. goal",
      "Habit streak",
    ],
  },
];

type Notice = { kind: "success" | "info"; text: string } | null;

export function WidgetGalleryClient() {
  const [isNative, setIsNative] = useState(false);
  const [canPin, setCanPin] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    // The bridge only exists in the browser; read it once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNative(isAndroidNativeApp());
    setCanPin(isPinAppWidgetSupported());
  }, []);

  const manualSteps =
    "Long-press an empty spot on your home screen, choose Widgets, find FitTracker and drag the widget you want onto the screen.";

  const handleAddWidget = (widgetId: WidgetId) => {
    if (!isNative) {
      setNotice({
        kind: "info",
        text: "Home screen widgets are part of the FitTracker Android app. Install the app, then add them from this page or from your launcher's widget list.",
      });
      return;
    }
    if (canPin && requestPinAppWidget(widgetId)) {
      setNotice({
        kind: "success",
        text: "Your launcher opened its confirmation. Tap Add to place the widget.",
      });
      return;
    }
    setNotice({
      kind: "info",
      text: `Your launcher does not let apps add widgets directly. ${manualSteps}`,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-elevated text-ink border border-line flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
              Android app
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Home screen widgets</h2>
          <p className="text-sm text-ink-2 mt-1 max-w-xl">
            {isNative
              ? "Add FitTracker widgets to your home screen. Steps update while the app is open and when you tap Sync on a widget; the other numbers update each time you open the dashboard."
              : "These widgets are available in the FitTracker Android app. They cannot be added from a web browser."}
          </p>
        </div>

        {!isNative && (
          <button
            type="button"
            onClick={() => openExternalLink(ANDROID_RELEASES_URL)}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-control bg-surface border border-line hover:border-line-strong text-ink-2 hover:text-ink text-sm font-semibold transition shrink-0"
          >
            <span>Get the Android app</span>
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          className={`p-4 rounded-2xl border text-sm flex items-start justify-between gap-3 ${
            notice.kind === "success"
              ? "bg-elevated border-line text-ink"
              : "bg-elevated border-line text-warn"
          }`}
        >
          <div className="flex items-start gap-2">
            {notice.kind === "success" ? (
              <Check className="w-4 h-4 mt-0.5 text-ink shrink-0" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 mt-0.5 text-warn shrink-0" aria-hidden="true" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="min-h-11 px-3 -my-3 -me-2 text-xs font-semibold text-ink-2 hover:text-ink shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Widget Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {WIDGETS_LIST.map((w) => (
          <div
            key={w.id}
            className="p-5 sm:p-6 rounded-card bg-surface border border-line flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-elevated text-ink border border-line">
                {w.gridSize}
              </span>

              <div>
                <h2 className="text-lg font-semibold text-ink">{w.name}</h2>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">{w.description}</p>
              </div>

              {/* Example preview (sample numbers) */}
              <figure className="p-4 rounded-card bg-canvas border border-line space-y-3 select-none">
                {w.id === "small" && (
                  <div className="space-y-2.5 text-center">
                    <div className="flex items-center text-xs text-ink-2 font-semibold">STEPS</div>
                    <div className="py-1">
                      <div className="text-2xl font-semibold text-ink tabular-nums tracking-tight">8,450</div>
                      <div className="text-xs text-ink-2">84% of 10k</div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div className="w-[84%] h-full bg-ink rounded-full" />
                    </div>
                    <div className="text-xs text-ink-2">6.3 km</div>
                  </div>
                )}

                {w.id === "medium" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-ink">
                        <Footprints className="w-3.5 h-3.5 text-ink" aria-hidden="true" />
                        <span>FIT TRACKER</span>
                      </div>
                      <RefreshCw className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xl font-semibold text-ink tabular-nums">8,450</span>
                        <span className="text-xs font-semibold text-ink">84%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-elevated mt-1.5 overflow-hidden">
                        <div className="w-[84%] h-full bg-ink rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-2 pt-1 border-t border-line">
                      <span>6.3 km • 338 kcal</span>
                      <span>Synced 9:41 AM</span>
                    </div>
                  </div>
                )}

                {w.id === "large" && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">FIT TRACKER</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-elevated text-ink-2 border border-line font-semibold">
                        <Flame className="w-3 h-3" aria-hidden="true" />
                        7d Streak
                      </span>
                    </div>
                    <div className="p-2 rounded-control bg-surface border border-line">
                      <div className="flex justify-between text-xs text-ink-2 mb-1">
                        <span className="font-semibold text-ink">8,450 steps</span>
                        <span>84%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div className="w-[84%] h-full bg-ink rounded-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-control bg-surface border border-line">
                        <span className="text-ink-2 font-semibold block">1,820</span>
                        <span className="text-ink-2">/ 2,400 kcal</span>
                      </div>
                      <div className="p-2 rounded-control bg-surface border border-line">
                        <span className="text-ink-2 font-semibold block">2,250</span>
                        <span className="text-ink-2">/ 3,000 ml</span>
                      </div>
                    </div>
                  </div>
                )}
                <figcaption className="text-xs text-ink-2 text-center">Example with sample numbers</figcaption>
              </figure>

              <ul className="space-y-1.5 text-sm text-ink-2 pt-1">
                {w.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-ink shrink-0" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => handleAddWidget(w.id)}
                className={buttonClasses({ variant: "primary", size: "lg", className: "w-full gap-2" })}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{isNative ? `Add ${w.gridSize} widget` : "Available in the Android app"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
