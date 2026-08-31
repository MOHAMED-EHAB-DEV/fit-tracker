# FitTracker Release Notes — Next.js 16 Clean Architecture & Performance Upgrade

> **Release Version**: 1.0.4  
> **Target Framework**: Next.js 16.3.1 · React 19.2.8 · Bun 1.4  
> **Environment**: Android WebView Hybrid App & Web Platform  
> **Date**: 2026-08-31

---

## 🚀 Overview

This release completes a comprehensive architectural overhaul of FitTracker, transitioning from client-heavy hydration to a performant, server-first App Router architecture optimized specifically for Android WebView runtime constraints.

---

## 📦 Key Highlights & Enhancements

### 1. Route Boundaries & Resilience (Phase 1)
- **Ambient Loading Skeletons**: Added custom, flicker-free skeleton screens for all route groups (`app/loading.tsx`, `app/(app)/loading.tsx`, `app/(auth)/loading.tsx`, `app/(admin)/admin/loading.tsx`).
- **Standardized Error Boundaries**: Implemented interactive error boundaries with in-shell retry triggers and diagnostic digest reference codes across root, app, auth, and admin routes (`error.tsx`, `global-error.tsx`).
- **Custom 404 Pages**: Created branded not-found screens with compass radar graphics and fast-action links (`app/not-found.tsx`, `app/(app)/not-found.tsx`).
- **PWA Manifest Resolution**: Added `public/manifest.json` resolving metadata 404 errors.
- **Continuous Client Navigation**: Eliminated all `window.location.href` hard reloads in `Sidebar`, `OnboardingFlow`, and `AdminSidebar`/`AdminMobileNav` in favor of Next.js `useRouter` transitions.

---

### 2. Server/Client Boundary & Bundle Optimization (Phase 2)
- **Zero-Bundle Server Components**: Converted presentational widgets (such as `RecentPRsWidget`) to pure Server Components, reducing initial client hydration JavaScript.
- **Deferred Chart Chunks**: Code-split heavyweight `recharts` dependencies in `EnergyBalanceChart` and `WeightTrendWidget` using `next/dynamic` (`ssr: false`) with placeholder skeleton fallbacks, cutting critical-path JS by ~200KB.
- **On-Demand Modal Code Splitting**: Converted heavy modal dialogs (`QuickLogModal`, `EditMealModal`, `Modal` in workout cards and weekly routine maps) to deferred dynamic imports, loading modal assets only upon user click.
- **Server Data Prefetching**: Refactored `SettingsPage` to prefetch sanitized user data on the server, eliminating client-side hydration delays.

---

### 3. Server Actions & Zero-Latency Mutations (Phase 3)
Created a centralized Server Actions module (`lib/fitness/actions.ts`) with automatic `revalidatePath` cache synchronization:
- `logWaterAction`: Direct database increment for hydration tracking with optimistic UI transitions (replacing AI chat route roundtrips).
- `deleteWorkoutAction`: Direct server-side workout deletion and multi-route cache revalidation.
- `deleteMealAction`: Server-side meal removal with automatic daily caloric and macronutrient adjustments in `DailyLog`.
- `updateWeeklyRoutineAction`: Direct routine split schedule updates.
- `updateProfileSettingsAction`: Server Action for profile and metabolic target updates with automated BMR/TDEE recalculations.

---

### 4. Android WebView Native Experience (Phase 4)
- **Centralized Bridge Service (`services/webview-bridge.ts`)**: Built a unified abstraction for Android bridge communication (hardware sensor synchronization, OTA update checking, external URL delegation).
- **Hardware Back Button / Swipe Gesture Interception**: Integrated a `popstate` history trap in `hooks/useDialogOverlay.ts` ensuring Android hardware back gestures dismiss open modals and drawers rather than navigating away from the page.
- **Dynamic Viewport Height**: Updated chat interfaces from `100vh` to `100dvh` in `CoachClient.tsx` to eliminate on-screen keyboard layout jumping.
- **Native View Transitions**: Added CSS `@supports (view-transition-name: none)` crossfade rules in `app/globals.css` for instant page crossfades in Chromium WebViews.
- **Edge-to-Edge Safe Areas**: Configured `viewportFit: "cover"` in root layout metadata for bezel-to-bezel display padding.
- **GPU & Overscroll Polish**: Applied `overscroll-behavior: none` and `@media (prefers-reduced-transparency: reduce)` fallbacks to protect GPU performance on low-end mobile hardware.

---

## 🛠️ Validation & Code Quality

- **TypeScript Typecheck**: `tsc --noEmit` passed with **0 errors** across all files.
- **Tailwind CSS Utility Audit**: Standardized all arbitrary value warnings (`h-95`, `min-h-11`, `min-h-10`, `min-h-9`, `rounded-md`, `bg-size-[200%_100%]`).
- **Preserved Design Integrity**: Maintained full visual fidelity, dark-mode zinc aesthetics, emerald/teal accents, and accessible contrast ratios.
