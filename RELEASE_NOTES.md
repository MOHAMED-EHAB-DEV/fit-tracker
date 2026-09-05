# FitTracker Release Notes — Native Home Screen Widgets & Habit Gamification

> **Release Version**: 1.2.0  
> **Target Framework**: Next.js 16.3.1 · React 19.2.8 · Android SDK 34  
> **Environment**: Android Native App, Home Screen Widgets & Web Platform  
> **Date**: 2026-09-05

---

## 🚀 Overview

FitTracker **v1.2.0** introduces native Android home screen habit streak integration, 1-click widget pinning from the web view, an interactive Widgets Gallery, and a zero-cost value suite including Bring Your Own Key (BYOK) Gemini AI support, privacy data export, and curated workout splits.

---

## 📦 Key Highlights & Enhancements

### 1. Android Home Screen Habit Streak Widget
- **Live Flame Badge**: Integrated live habit streak counter (`🔥 Xd Streak`) into the header of `widget_fitness_large.xml`.
- **Bidirectional Telemetry Sync**: Synchronizes consecutive logging days, longest streaks, and daily active status from `StreakWidget.tsx` through `JSBridge.updateWidgetData()` into native `WidgetDataStore.kt`.
- **Automatic Lifecycle Refresh**: Widgets refresh seamlessly on resume, daily sensor updates, and background WorkManager synchronization.

### 2. 1-Click Native Widget Pinning API
- **AppWidgetManager Integration**: Implemented `AppWidgetManager.requestPinAppWidget()` inside `JSBridge.kt` (Android 8.0+ / API 26+).
- **Launcher Confirmation**: Users can add any widget directly to their Android launcher from inside the app with a single click, without navigating through system widget menus.

### 3. Interactive Widgets Gallery (`/widgets`)
- **Visual Mockups**: High-fidelity live previews of all 3 home screen widgets:
  - **Quick Pedometer (2x2 Small)**
  - **Activity & Steps Bar (4x2 Medium)**
  - **Complete Fitness & Habit Hub (4x3 Large)**
- **Add to Home Screen Buttons**: 1-click pinning triggers the native Android launcher prompt.
- **Quick Access**: Accessible from the Settings page and direct navigation.

### 4. Bring Your Own Key (BYOK) for Gemini AI
- **Zero Operating Costs**: Users can supply their free Google AI Studio API key in Settings to run personal inferences with unlimited rate limits.
- **Per-Request Override**: Gracefully falls back to the server environment key if no personal key is entered.

### 5. 1-Click Privacy Data Export (GDPR / Backup)
- **Zero Lock-In**: Dedicated `/api/user/export` endpoint generating a structured JSON archive of user profile, daily nutrition logs, workout history, body composition check-ins, and personal records.

### 6. Curated Workout Splits & Auto-Seeding
- **Battle-Tested Templates**: Preloaded with 6 structured training splits (Push, Pull, Legs, Upper Power, Lower Power, Full Body Foundation).
- **Auto-Population**: Creating a workout from a template automatically prefills exercise names, muscle groups, sets, and rep ranges.

### 7. PWA Mobile Web Experience
- **1-Click Web App Installation**: Responsive, dismissible banner supporting Chromium `beforeinstallprompt` and step-by-step "Add to Home Screen" instructions for iOS Safari.

---

## 🛠️ Validation & Code Quality
- **Zero Build / TypeScript Warnings**: Full strict mode typing adherence with `tsc --noEmit`.
- **RemoteViews Architecture**: 100% compliant with Android RemoteViews layout constraints.
- **RTL & Logical Spacing**: Applied logical attributes (`paddingStart`, `paddingEnd`, `layout_marginStart`, `layout_marginEnd`, `inset-s-`, `inset-e-`).
