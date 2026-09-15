# FitTracker Release Notes — v2.0.0: AI Day Planner & Unified Habit Engine

> **Release Version**: 2.0.0 (Version Code: 11)  
> **Target Framework**: Next.js 16.3.1 · React 19.2.8 · Bun 1.4.0 · Android SDK 34 (API 24–35)  
> **Environment**: Android Native App, WebView Bridge & Web Platform  
> **Date**: 2026-09-15  

---

## 🚀 Overview

FitTracker **v2.0.0** is a landmark major release introducing the **AI-Powered Day Planner**, a unified daily scheduling and habit execution system. Users can now plan, structure, and visualize their days with an intelligent chronological timeline (5:00 AM to 12:00 AM), connect daily habits directly to scheduled time blocks, synchronize daily logs automatically upon completion, generate balanced day plans with Gemini AI, and receive real-time notification reminders via the native Android bridge.

---

## 📦 Key Highlights & Enhancements

### 1. 🤖 Gemini AI Day Planner (`/planner`)
- **Automated Schedule Generation**: Integrated Google Gemini AI to analyze user active habits and generate structured, disciplined daily timelines with morning routines, deep focus blocks, workouts, meals, and recovery periods.
- **Preview & Direct Apply**: Review AI-suggested schedules in an interactive modal with options to merge with existing plans or replace the day's schedule.
- **Customizable Prompts**: Custom prompt controls with quick chips ("Heavy Workout Day", "Deep Focus & Study", "Balanced Rest Day") to tailor schedule generation to daily priorities.

### 2. ⏱️ Chronological Timeline Engine (5:00 AM to 12:00 AM Cycle)
- **Natural Day Flow**: Configured a specialized 5:00 AM to 12:00 AM sort cycle reflecting authentic circadian fitness routines.
- **Live "Now" Indicator**: Dynamic real-time marker pulsing on today's timeline, indicating current position relative to scheduled events.
- **Categorized Event Badging**: Visual categories with tailored badges and accents:
  - 🏋️ Workout
  - 🥗 Nutrition
  - ⚡ Habit
  - 🧘 Recovery
  - 🎯 Deep Focus
  - ⏰ Other / General

### 3. 🔄 Recurrence Engine & Multi-Day Persistence
- **Flexible Recurrence**: Support for one-time (`once`), `daily`, `weekly`, and `monthly` events.
- **Per-Date Completion Tracking**: Recurring events maintain independent `completedDates` arrays, preserving history across dates without duplicating database records.
- **Granular Deletion**: Option to delete "Only This Occurrence" (adding to `excludedDates`) or "All Recurring Occurrences".

### 4. ⚡ Seamless Habit Integration & Daily Log Sync
- **Connected Habits**: Attach active habits directly to planned events with instant visual emoji pills.
- **Two-Way Completion Sync**: Completing an event automatically marks all linked habits as completed in the user's `DailyLog`, keeping dashboard streaks and daily logs perfectly in sync.
- **Mongoose Dirty Tracking & Schema Registration**: Bulletproofed habit array updates with explicit `ObjectId` casting and `markModified` calls.

### 5. 🎨 Design System & Native Drawer Architecture
- **Antigravity Drawer Integration**: Replaced ad-hoc overlays with the native `Drawer` component featuring smooth slide animations, backdrop blur, and full responsive support.
- **Optimized Edit Flow**: Clear dual-state drawer footer featuring distinct `[Cancel]` and `[Save Changes]` actions in edit mode.
- **Full RTL & Logical Styling**: Strict alignment with logical properties (`ms-`, `me-`, `ps-`, `pe-`, `border-s-`) ensuring flawless Arabic and English presentation.

### 6. 📱 Android Native Notification Bridge
- **WebView Bridge Integration**: Implemented `triggerSystemNotification` bridge connecting web planner events to Android system notifications via `PlannerNotificationManager`.
- **In-App Test Notifications**: Trigger instant test alerts directly from event cards or drawer views.

### 7. 📊 Dashboard Quick-Access Widget (`/`)
- **Today's Plan Widget**: Dedicated timeline preview on the main dashboard showing upcoming tasks, completion progress bar, and quick completion toggles without navigating away.

---

## 🛠️ Validation & Code Quality
- **Zero Errors & Warnings**: Clean TypeScript build and 0 runtime linting issues across all new endpoints and UI components.
- **Serverless & Hot-Reload Safe**: Global Mongoose connection pooling and eager model registration.
- **Strict Backward Compatibility**: Retained full Android 7.0–15 native support and previous v1.2.2 system bar fixes.

---

## 📜 Previous Releases

### FitTracker v1.2.2 — Android 13+ (14 & 15) Compatibility & System Modernization
- Configured dedicated dark system status and navigation bars (`@color/background_dark`) with light icons (`windowLightStatusBar=false`).
- App and WebView render cleanly below the status bar, preventing system bar overlaps.
- Migrated to `OnBackPressedCallback` integrated with `onBackPressedDispatcher` with `android:enableOnBackInvokedCallback="true"`.
- Added `READ_MEDIA_VISUAL_USER_SELECTED` permission for Android 14+ Selected Photos Access.
- Attached `ClipData` with explicit read/write flags to `takePictureIntent` in `launchFileChooser()`.
- Set explicit package targeting (`setPackage(context.packageName)`) on widget sync broadcasts (`ACTION_SYNC_WIDGET`).
