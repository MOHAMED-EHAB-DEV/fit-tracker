# FitTracker Release Notes — Android 13+ (14 & 15) Compatibility & System Modernization

> **Release Version**: 1.2.2  
> **Target Framework**: Next.js 16.3.1 · React 19.2.8 · Android SDK 34 (API 33, 34, 35 compatible)  
> **Environment**: Android Native App, Home Screen Widgets & Web Platform  
> **Date**: 2026-09-08  

---

## 🚀 Overview

FitTracker **v1.2.2** ensures the app and WebView render cleanly below the status bar, preventing system bar overlaps while retaining full compatibility with all Android versions over Android 13 (Android 14 & 15).

---

## 📦 Key Highlights & Enhancements

### 1. Modern Predictive Back Gesture Support (Android 13+)
- Migrated from deprecated `onBackPressed()` to `OnBackPressedCallback` integrated with `onBackPressedDispatcher`.
- Enabled `android:enableOnBackInvokedCallback="true"` in `AndroidManifest.xml` to support smooth system-level predictive back gesture animations on Android 13, 14, and 15 without accidental app exits.

### 2. Status Bar & Window Layout Management
- Configured dedicated dark system status and navigation bars (`@color/background_dark`) in `themes.xml` with light icons (`windowLightStatusBar=false`).
- App and WebView render cleanly below the status bar, preventing system bar overlaps with the web interface.

### 3. Granular Media Permissions & Camera URI Grants (Android 13 & 14)
- Added `READ_MEDIA_VISUAL_USER_SELECTED` permission for Android 14+ Selected Photos Access, allowing users to grant partial gallery permissions.
- Attached `ClipData` with explicit read/write flags to `takePictureIntent` in `launchFileChooser()` to prevent camera app `SecurityException: Permission Denial` on Android 13+.
- Added `POST_NOTIFICATIONS` manifest declaration and runtime request handling on Android 13+ (`Build.VERSION_CODES.TIRAMISU`).

### 4. Package Visibility & Intent Queries (Android 11+ / 13+ / 14+)
- Added `<queries>` block in `AndroidManifest.xml` covering `IMAGE_CAPTURE`, package archive view (`.apk`), and file picker actions for strict package visibility rules.
- Attached `ClipData` to OTA updater `installIntent` ensuring package installer processes receive immediate URI permissions.

### 5. Broadcast Security & Internal Component Protection (Android 14)
- Set explicit package targeting (`setPackage(context.packageName)`) on widget sync broadcasts (`ACTION_SYNC_WIDGET`) to prevent implicit broadcast restrictions on Android 14.

### 6. Modernized PackageManager APIs
- Replaced deprecated `getPackageInfo(String, Int)` and `queryIntentActivities(Intent, Int)` with typed `PackageInfoFlags.of(0)` and `ResolveInfoFlags.of(...)` on API 33+.

---

## 🛠️ Validation & Code Quality
- **Full Backward & Forward Compatibility**: Fully compatible with Android 7.0 (API 24) through Android 15 (API 35+).
- **Zero Warnings**: Deprecated back navigation and package query APIs eliminated.
- **RTL & Logical Spacing**: Preserved all logical styling and safe-area insets.
