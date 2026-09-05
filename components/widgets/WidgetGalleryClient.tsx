"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Check,
  Flame,
  Footprints,
  Droplets,
  Plus,
  RefreshCw,
  Sparkles,
  Info,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  isAndroidNativeApp,
  isPinAppWidgetSupported,
  requestPinAppWidget,
  openExternalLink,
} from "@/services/webview-bridge";

interface WidgetInfo {
  id: "small" | "medium" | "large";
  name: string;
  gridSize: string;
  description: string;
  badge: string;
  features: string[];
}

const WIDGETS_LIST: WidgetInfo[] = [
  {
    id: "small",
    name: "Quick Pedometer",
    gridSize: "2 × 2 Small",
    description: "Glanceable daily step count, goal progress, and estimated active calories.",
    badge: "Minimalist",
    features: [
      "Hardware sensor step telemetry",
      "Goal progress ring",
      "Active calorie counter",
      "Tap to launch app",
    ],
  },
  {
    id: "medium",
    name: "Activity & Steps Bar",
    gridSize: "4 × 2 Medium",
    description: "Dynamic goal bar with distance, active burn, and 1-tap background sensor sync.",
    badge: "Most Popular",
    features: [
      "Real-time step percentage bar",
      "Kilometers & active calories",
      "Interactive 1-tap instant sync",
      "Direct app navigation",
    ],
  },
  {
    id: "large",
    name: "Complete Fitness & Habit Hub",
    gridSize: "4 × 3 Large",
    description: "The complete daily fitness overview featuring nutrition, water, steps, and habit streak.",
    badge: "Full Telemetry",
    features: [
      "Live Habit Streak 🔥 counter",
      "Calorie balance & daily target",
      "Hydration level meter",
      "Live hardware sensor sync",
    ],
  },
];

export function WidgetGalleryClient() {
  const [isNative, setIsNative] = useState(false);
  const [canPin, setCanPin] = useState(false);
  const [pinnedWidget, setPinnedWidget] = useState<string | null>(null);
  const [webNotice, setWebNotice] = useState(false);

  useEffect(() => {
    setIsNative(isAndroidNativeApp());
    setCanPin(isPinAppWidgetSupported());
  }, []);

  const handleAddWidget = (widgetId: "small" | "medium" | "large") => {
    if (isNative && canPin) {
      const success = requestPinAppWidget(widgetId);
      if (success) {
        setPinnedWidget(widgetId);
        setTimeout(() => setPinnedWidget(null), 4000);
      }
    } else {
      setWebNotice(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
              Android Home Screen Suite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Live Home Screen Widgets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Preview and add native Android widgets directly to your launcher without leaving the app.
          </p>
        </div>

        {isNative ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>1-Click Pinning Ready (Android)</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              openExternalLink("https://github.com/MOHAMED-EHAB-DEV/fit-tracker/releases/latest")
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition shrink-0"
          >
            <span>Get Android APK</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Success Notification */}
      {pinnedWidget && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Home screen confirmation dialog opened! Tap <strong>Add</strong> to place the widget.
            </span>
          </div>
        </div>
      )}

      {/* Web Notice for Non-Android Users */}
      {webNotice && !isNative && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Native Android Feature</span>
            </div>
            <button
              type="button"
              onClick={() => setWebNotice(false)}
              className="text-amber-400 hover:text-amber-200 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            1-click home screen pinning is powered by Android&apos;s native{" "}
            <code className="text-amber-300 font-mono">AppWidgetManager</code>. To install these widgets, run FitTracker inside the Android app wrapper or long-press your home screen launcher to pick FitTracker widgets manually.
          </p>
        </div>
      )}

      {/* Widget Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {WIDGETS_LIST.map((w) => (
          <div
            key={w.id}
            className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 hover:border-emerald-500/40 transition flex flex-col justify-between space-y-6 group shadow-lg backdrop-blur-md relative overflow-hidden"
          >
            {/* Ambient Card Glow */}
            <div
              className="absolute -top-12 -inset-e-12 w-32 h-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition duration-500"
              aria-hidden="true"
            />

            <div className="space-y-4">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {w.gridSize}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  {w.badge}
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition">
                  {w.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {w.description}
                </p>
              </div>

              {/* High-Fidelity UI Widget Mockup */}
              <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 shadow-inner space-y-3 select-none">
                {w.id === "small" && (
                  <div className="space-y-2.5 text-center">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="font-bold text-zinc-400">STEPS</span>
                      <span className="text-emerald-400 font-bold">● LIVE</span>
                    </div>
                    <div className="py-2">
                      <div className="text-2xl font-black text-white tabular-nums tracking-tight">
                        8,450
                      </div>
                      <div className="text-[10px] text-zinc-400">84% of 10,000</div>
                    </div>
                    <div className="flex items-center justify-center gap-3 text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                      <span>6.3 km</span>
                      <span>•</span>
                      <span>338 kcal</span>
                    </div>
                  </div>
                )}

                {w.id === "medium" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                        <span>TODAY&apos;S STEPS</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10">
                        84%
                      </span>
                    </div>
                    <div>
                      <div className="text-xl font-black text-white tabular-nums">8,450</div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 mt-1.5 overflow-hidden">
                        <div className="w-[84%] h-full bg-linear-to-r from-emerald-500 to-teal-400 rounded-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                      <span>6.3 km • 338 kcal</span>
                      <span className="text-zinc-500">Synced just now</span>
                    </div>
                  </div>
                )}

                {w.id === "large" && (
                  <div className="space-y-2.5">
                    {/* Top row: Brand + Streak Badge */}
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 font-extrabold text-white">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>FIT TRACKER</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 font-bold text-[9px]">
                        <Flame className="w-3 h-3" />
                        <span>7d Streak</span>
                      </div>
                    </div>

                    {/* Step Bar */}
                    <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
                      <div className="flex justify-between text-[10px] text-zinc-300 mb-1">
                        <span className="font-bold text-emerald-400">Steps: 8,450</span>
                        <span>84%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="w-[84%] h-full bg-emerald-500 rounded-full" />
                      </div>
                    </div>

                    {/* Nutrition + Hydration Row */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
                        <span className="text-orange-400 font-bold block">1,820 kcal</span>
                        <span className="text-[9px] text-zinc-500">/ 2,400 kcal</span>
                      </div>
                      <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
                        <span className="text-cyan-400 font-bold block">2,250 ml</span>
                        <span className="text-[9px] text-zinc-500">/ 3,000 ml</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-1.5 text-xs text-zinc-400 pt-1">
                {w.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Add Widget CTA */}
            <div className="pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleAddWidget(w.id)}
                className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black text-xs transition shadow-md shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Home Screen ({w.gridSize.split(" ")[0]})</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
