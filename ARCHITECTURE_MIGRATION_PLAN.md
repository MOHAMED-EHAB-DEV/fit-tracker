# Architecture Migration Plan — AI Fit Tracker

> **Generated**: 2026-08-31  
> **Next.js**: 16.3.1 · **React**: 19.2.8 · **Runtime**: Bun 1.4  
> **Deployed**: Vercel · **Rendered inside**: Android WebView wrapper ([FitTrackerAndroid/](file:///d:/fit-tracker/FitTrackerAndroid))

---

## 1 · Executive Summary

Fit Tracker is an AI-powered fitness companion (dashboard, workouts, nutrition, body composition, AI coach, admin panel) rendered inside an Android WebView. The codebase is **well-structured at the route level** — route groups `(app)`, `(auth)`, `(admin)` are logical, pages properly delegate to async server components with `<Suspense>`, and `next/link` is used consistently. TypeScript strict mode is already enabled.

### Top Risk Areas

| # | Risk | Severity | Affected Files |
|---|------|----------|---------------|
| 1 | **Nearly all components are `'use client'`** — 50+ files carry the directive, including every dashboard widget, meaning the entire dashboard hydrates client-side despite most widgets being static server-renderable | 🔴 Critical | All of `components/dashboard/`, `components/workout/`, etc. |
| 2 | **God components** — 6 files exceed 500 LOC, mixing data-fetching, state, UI, and mutation logic in one file | 🔴 Critical | `WeeklySplitMap.tsx` (955 LOC), `RecordWorkoutClient.tsx` (750), `CoachClient.tsx` (748), `OnboardingFlow.tsx` (648), `QuickLogModal.tsx` (518), `SettingsClient.tsx` (371) |
| 3 | **Zero `loading.tsx` / `error.tsx` / `not-found.tsx` files** across all route segments — fallbacks exist only as inline `<Suspense>` in individual pages | 🟠 High | Every route under `app/` |
| 4 | **No Server Actions (`"use server"`)** — all mutations go through `fetch('/api/...')` calls from client components, missing React 19/Next 16's primary mutation primitive | 🟠 High | All mutation flows |
| 5 | **Android WebView gaps** — missing `viewport-fit=cover`, missing `overscroll-behavior`, `100vh` usage in CoachClient, `window.location.href` causing full page reloads, missing manifest.json despite being referenced | 🟠 High | Multiple files |
| 6 | **`UserProvider` wraps entire `(app)` layout** — forces client boundary at layout level, preventing server rendering of Sidebar/MobileNav content | 🟡 Medium | [(app)/layout.tsx](file:///d:/fit-tracker/app/(app)/layout.tsx) |
| 7 | **`recharts` ships to client for 2 chart components** — heavyweight charting library in the dashboard critical path | 🟡 Medium | `EnergyBalanceChart.tsx`, `WeightTrendWidget.tsx` |

### What's Already Good

- ✅ TypeScript strict mode enabled, no `any` in type signatures (some remain in `.lean()` casts — Mongoose limitation)
- ✅ `next/font/google` used (Inter)
- ✅ `next/image` used where images appear (7 components)
- ✅ No raw `<img>` tags found
- ✅ Metadata API used on every page with proper titles/descriptions
- ✅ No WebGL/Three.js/canvas-heavy animation (clean — no GSAP/Framer Motion either, CSS-only)
- ✅ No barrel files (`index.ts` re-exports) — imports are direct
- ✅ No Lenis/scroll-smooth conflicts
- ✅ `prefers-reduced-motion` respected in globals.css
- ✅ Safe-area padding classes exist (`safe-area-pb`, `safe-area-pt`)
- ✅ `AndroidBridge` WebView bridge already implemented ([useNativeStepTracker.ts](file:///d:/fit-tracker/hooks/useNativeStepTracker.ts))

---

## 2 · Current Directory Structure

```
fit-tracker/
├── app/
│   ├── layout.tsx                    # Root layout (server) — Inter font, viewport meta
│   ├── globals.css                   # Tailwind v4 + custom utilities
│   ├── (app)/                        # Authenticated app shell
│   │   ├── layout.tsx                # Auth check → UserProvider → Sidebar/MobileNav
│   │   ├── page.tsx                  # Dashboard (416 LOC server component)
│   │   ├── workouts/                 # Workout CRUD routes
│   │   │   ├── page.tsx              # List (143 LOC server)
│   │   │   ├── new/page.tsx          # Create (thin → NewWorkoutClient)
│   │   │   ├── record/page.tsx       # Record stats (thin → RecordWorkoutClient)
│   │   │   ├── templates/page.tsx    # Browse templates (131 LOC server)
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Edit routine (107 LOC server)
│   │   │       └── active/page.tsx   # Live gym session (111 LOC server)
│   │   ├── nutrition/
│   │   │   ├── page.tsx              # Today's macros (174 LOC server)
│   │   │   └── analyze/page.tsx      # AI photo analysis (thin → PhotoAnalyzer)
│   │   ├── body-comp/page.tsx        # Check-ins (66 LOC server)
│   │   ├── coach/page.tsx            # AI chat (thin → CoachClient)
│   │   ├── settings/page.tsx         # User settings (thin → SettingsClient)
│   │   └── dashboard/               # Empty directory
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (admin)/admin/
│   │   ├── layout.tsx                # Admin shell with admin auth
│   │   ├── dashboard/exercises/nutrition/users/ ...
│   │   └── page.tsx
│   ├── api/                          # 13 API route handlers
│   │   ├── auth/ (login/logout/me/signup)
│   │   ├── workouts/ meals/ body-comp/ exercises/ ...
│   │   └── assistant/ steps/ profile/ user/ ...
│   ├── onboarding/page.tsx           # Profile setup wizard
│   └── fit-tracker/images/           # Proxied Cloudinary images
│
├── components/                       # Feature-grouped but ALL 'use client'
│   ├── dashboard/ (10 files, 114 KB) # Widgets: MetricsGrid, EnergyBalanceChart, WeeklySplitMap...
│   ├── workout/ (15 files, 170 KB)   # Workout CRUD: RecordWorkoutClient, ExerciseSearch...
│   ├── nutrition/ (3 files, 37 KB)   # MealListClient, PhotoAnalyzer, EditMealModal
│   ├── body-comp/ (1 file, 12 KB)    # BodyCompClient
│   ├── coach/ (1 file, 29 KB)        # CoachClient — entire AI chat in one file
│   ├── settings/ (1 file, 17 KB)     # SettingsClient — entire settings in one file
│   ├── onboarding/ (2 files, 42 KB)  # OnboardingFlow + InteractiveRuler
│   ├── auth/ (2 files, 13 KB)        # LoginForm, SignupForm
│   ├── admin/ (14 files, 146 KB)     # Full admin panel
│   ├── shared/ (2 files, 6 KB)       # Sidebar, MobileNav
│   ├── ui/ (11 files, 50 KB)         # Primitives: Button, Card, Modal, Select...
│   └── brand/ (empty)
│
├── lib/                              # Backend utilities
│   ├── auth/ (5 files)               # JWT, session, cookies, password, admin
│   ├── db/models/ (8 models)         # Mongoose: User, Workout, Meal, DailyLog, BodyComp...
│   ├── api/ (3 files)                # Cache, rate-limit, middleware wrapper
│   ├── gemini/ (5 files)             # Gemini AI: client, prompts, schemas, parser, compressor
│   ├── fitness/ (4 files)            # BMR, 1RM, timezone, unit conversion
│   ├── cloudinary/ image-proxy/
│   └── utils.ts, image-loader.ts
│
├── hooks/ (13 files)                 # Global hooks (all 'use client')
├── context/ (1 file)                 # UserContext.tsx — single context provider
├── types/ (3 files)                  # auth, fitness, gemini type defs
├── constants/ (5 files)              # exercise, navigation, nutrition, user, workout
└── FitTrackerAndroid/                # Android WebView wrapper (Kotlin/Gradle)
```

**Organizing principle**: Feature-grouped components under `components/<feature>/`, thin server pages in `app/` that delegate to feature components. However, the boundary is compromised because every component is `'use client'`, negating the server-rendering architecture.

---

## 3 · Route-by-Route Audit

| Route | File | LOC | Server/Client | Data Fetching | Heavy Deps | Issues |
|-------|------|-----|---------------|---------------|------------|--------|
| `/` (Dashboard) | [(app)/page.tsx](file:///d:/fit-tracker/app/(app)/page.tsx) | 416 | ✅ Server | Direct Mongoose `.lean()` | recharts (via children) | Server component is well-structured; but all 8 child widgets are `'use client'` — most could be server |
| `/workouts` | [workouts/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/page.tsx) | 143 | ✅ Server | Direct Mongoose | — | `WorkoutListCard` is client but only needs client for delete action |
| `/workouts/new` | [new/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/new/page.tsx) | 13 | Thin shell | — | — | Immediately renders `NewWorkoutClient` — no server data passed |
| `/workouts/record` | [record/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/record/page.tsx) | 25 | Thin shell | — | — | `RecordWorkoutClient` (750 LOC god component) fetches all data client-side |
| `/workouts/[id]` | [[id]/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/[id]/page.tsx) | 107 | ✅ Server | Direct Mongoose | — | Good pattern — server loads, passes to client |
| `/workouts/[id]/active` | [active/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/[id]/active/page.tsx) | 111 | ✅ Server | Direct Mongoose | — | Good pattern |
| `/workouts/templates` | [templates/page.tsx](file:///d:/fit-tracker/app/(app)/workouts/templates/page.tsx) | 131 | ✅ Server | Direct Mongoose | — | Pure server — no `'use client'` widgets |
| `/nutrition` | [nutrition/page.tsx](file:///d:/fit-tracker/app/(app)/nutrition/page.tsx) | 174 | ✅ Server | Direct Mongoose | — | Good split — summary is server, `MealListClient` handles interactions |
| `/nutrition/analyze` | [analyze/page.tsx](file:///d:/fit-tracker/app/(app)/nutrition/analyze/page.tsx) | 16 | Thin shell | — | — | `PhotoAnalyzer` (16KB) is fully client — acceptable for camera/upload UX |
| `/body-comp` | [body-comp/page.tsx](file:///d:/fit-tracker/app/(app)/body-comp/page.tsx) | 66 | ✅ Server | Direct Mongoose | — | `BodyCompClient` (12KB) receives server data — good |
| `/coach` | [coach/page.tsx](file:///d:/fit-tracker/app/(app)/coach/page.tsx) | 13 | Thin shell | — | — | `CoachClient` (748 LOC, 29KB) is a god component — entire chat UI + state + API |
| `/settings` | [settings/page.tsx](file:///d:/fit-tracker/app/(app)/settings/page.tsx) | 13 | Thin shell | — | — | `SettingsClient` (371 LOC) reads from `UserContext` client-side, re-fetches data the server already has |
| `/onboarding` | [onboarding/page.tsx](file:///d:/fit-tracker/app/onboarding/page.tsx) | 21 | ✅ Server | Auth check only | — | `OnboardingFlow` (648 LOC) is a client-only wizard — acceptable but decomposable |
| `/login` | [login/page.tsx](file:///d:/fit-tracker/app/(auth)/login/page.tsx) | ~15 | ✅ Server shell | — | — | Clean |
| `/signup` | [signup/page.tsx](file:///d:/fit-tracker/app/(auth)/signup/page.tsx) | ~15 | ✅ Server shell | — | — | Clean |

---

## 4 · God Components (> 300 LOC)

| Component | LOC | KB | Violations |
|-----------|-----|----|------------|
| [WeeklySplitMap.tsx](file:///d:/fit-tracker/components/dashboard/WeeklySplitMap.tsx) | **955** | 41KB | State management, routine editing modal, API mutations, drag-and-drop UI, 30+ lucide icons imported — all in one file |
| [RecordWorkoutClient.tsx](file:///d:/fit-tracker/components/workout/RecordWorkoutClient.tsx) | **750** | 32KB | Full workout recording flow: day selector, exercise list, set tracking, IntersectionObserver, floating toolbar, API save — single file |
| [CoachClient.tsx](file:///d:/fit-tracker/components/coach/CoachClient.tsx) | **748** | 29KB | Chat UI, message rendering, command parser, model selector, data context display, streaming fetch, 25+ icon imports |
| [OnboardingFlow.tsx](file:///d:/fit-tracker/components/onboarding/OnboardingFlow.tsx) | **648** | 29KB | 6-step wizard with sex/age/height/weight/activity/habits — all steps in one component |
| [QuickLogModal.tsx](file:///d:/fit-tracker/components/dashboard/QuickLogModal.tsx) | **518** | 20KB | 4-tab modal (food/water/weight/steps) with full form state per tab |
| [SettingsClient.tsx](file:///d:/fit-tracker/components/settings/SettingsClient.tsx) | **371** | 17KB | Entire settings page — reads from UserContext instead of server props |

---

## 5 · Anti-Pattern Inventory

### 5.1 — `'use client'` Overuse (Critical)

**50+ components carry `'use client'`**, including widgets that are purely presentational. Examples:

- [MetricsGrid.tsx](file:///d:/fit-tracker/components/dashboard/MetricsGrid.tsx) (10KB) — receives `stats` as props, renders 4 metric cards. Uses `'use client'` but only for the `QuickLogModal` toggle button. The grid itself is server-renderable.
- [RecentPRsWidget.tsx](file:///d:/fit-tracker/components/dashboard/RecentPRsWidget.tsx) (4KB) — receives `prs` array as props, renders a list with links. No interactivity beyond links. Could be 100% server.
- [WorkoutListCard.tsx](file:///d:/fit-tracker/components/workout/WorkoutListCard.tsx) (7KB) — needs `'use client'` only for the delete confirmation + API call. The card rendering is server-renderable.

**Impact**: The entire dashboard tree hydrates client-side. On a mid-range Android device, this means ~200KB+ of JavaScript to parse/execute before the page becomes interactive.

### 5.2 — Missing Route-Level Error Boundaries

Zero `loading.tsx`, `error.tsx`, or `not-found.tsx` files exist anywhere in the `app/` directory. All loading states are handled via inline `<Suspense>` fallbacks in page components. While the `<Suspense>` pattern works, the absence of:
- `error.tsx` — means unhandled errors crash the entire route with no recovery UI
- `not-found.tsx` — means invalid URLs show the default Next.js 404 (no branding)
- `loading.tsx` — means nested navigations don't show instant feedback

### 5.3 — No Server Actions

All data mutations use `fetch('/api/...')` from client components. This means:
- Extra network round-trip through API route handlers
- No automatic form `<form action={...}>` integration
- No optimistic updates via `useActionState`/`useOptimistic`
- Client components must import `useRouter` + call `router.refresh()` after mutations (found in **17 locations**)

### 5.4 — Settings Page Re-fetches Server Data

[SettingsClient.tsx](file:///d:/fit-tracker/components/settings/SettingsClient.tsx) reads user data from `UserContext` (which was populated server-side in the layout), then initializes local state from it. The page could instead receive user data as server props directly.

### 5.5 — `window.location.href` Full Reloads

Found in 4 locations:
- `Sidebar.tsx:18` — logout redirects via `window.location.href = "/login"`
- `OnboardingFlow.tsx:183` — post-submit redirect
- `AdminSidebar.tsx:25` and `AdminMobileNav.tsx:22` — admin logout

Each causes a **full page reload** inside the WebView — white flash, history stack disruption, and loss of client state.

### 5.6 — Missing `viewport-fit=cover`

The viewport meta in [layout.tsx](file:///d:/fit-tracker/app/layout.tsx) sets `width: "device-width"` but does not include `viewportFit: "cover"`. This means `env(safe-area-inset-*)` values will always be 0 on edge-to-edge Android devices, making the existing `safe-area-pb`/`safe-area-pt` CSS classes ineffective.

### 5.7 — Missing `overscroll-behavior`

No `overscroll-behavior: none` or `contain` set on `body` or scroll containers. On Android WebView, pull-to-refresh and overscroll rubber-banding can interfere with in-app scroll behavior.

### 5.8 — `100vh` in CoachClient

[CoachClient.tsx:444](file:///d:/fit-tracker/components/coach/CoachClient.tsx) uses `h-[calc(100vh-8rem)]`. On Android WebView, `100vh` includes the URL bar/on-screen keyboard area, causing layout jumps. Should use `100dvh` or a JS-measured fallback.

### 5.9 — Missing `manifest.json`

[Root layout](file:///d:/fit-tracker/app/layout.tsx) references `manifest: "/manifest.json"` but no manifest file exists in `public/`. This causes a 404 on every page load.

### 5.10 — Recharts in Client Bundle

[EnergyBalanceChart.tsx](file:///d:/fit-tracker/components/dashboard/EnergyBalanceChart.tsx) and [WeightTrendWidget.tsx](file:///d:/fit-tracker/components/dashboard/WeightTrendWidget.tsx) import `recharts`, which adds ~200KB gzipped to the client bundle. These are below-the-fold widgets that could be lazy-loaded.

---

## 6 · Proposed Target Architecture

```
app/                                   # Routing shell — thin, server-only
  (app)/
    layout.tsx                         # Auth → server shell, client islands for Sidebar/MobileNav
    loading.tsx                        # Route-group skeleton
    error.tsx                          # Route-group error boundary
    not-found.tsx                      # Branded 404
    page.tsx                           # Dashboard composition (server)
    workouts/
      loading.tsx
      page.tsx
      ...
    nutrition/
      loading.tsx
      page.tsx
      ...
    (each route segment gets loading.tsx + error.tsx)
  (auth)/
    layout.tsx
    loading.tsx
    ...
  (admin)/
    ...

features/                             # Feature-based modules
  dashboard/
    components/                        # Server components by default
      MetricsGrid.tsx                  # Pure server — receives props, renders cards
      RecentPRsWidget.tsx              # Pure server — renders PR list
      WeightTrendWidget.tsx            # Server wrapper → lazy client chart
    components/client/                 # Explicit client islands
      EnergyBalanceChartClient.tsx     # recharts wrapper
      WaterCounterClient.tsx           # Interactive counter
      QuickLogTriggerClient.tsx        # Button + modal trigger
      WeeklySplitMapClient.tsx         # Split from 955-LOC god component
      DashboardHeaderClient.tsx        # Greeting + quick log
    actions.ts                         # Server Actions for water, quick-log
    types.ts
  workout/
    components/
      WorkoutListCard.tsx              # Server — static card layout
    components/client/
      WorkoutDeleteButton.tsx          # Tiny client island — delete action only
      RecordWorkout/                   # Split from 750-LOC god component
        RecordWorkoutShell.tsx
        ExerciseListPanel.tsx
        SetEditor.tsx
      ActiveSession/
        ActiveWorkoutSession.tsx
        ActiveExerciseCard.tsx
        RestTimer.tsx
      ExerciseSearch.tsx
      ExerciseInstructionsModal.tsx
    actions.ts                         # Server Actions for CRUD
    types.ts
  nutrition/
    components/
      NutritionSummary.tsx             # Server — macro cards
    components/client/
      MealListClient.tsx
      EditMealModal.tsx
      PhotoAnalyzer.tsx
    actions.ts
    types.ts
  body-comp/
    components/client/
      BodyCompClient.tsx
    actions.ts
    types.ts
  coach/
    components/client/
      ChatContainer.tsx                # Split from 748-LOC
      MessageBubble.tsx
      CommandPalette.tsx
      ModelSelector.tsx
    types.ts
  settings/
    components/
      SettingsPage.tsx                 # Server — receives user as props
    components/client/
      SettingsForm.tsx                 # Client — form interactions only
    actions.ts
  onboarding/
    components/client/
      OnboardingWizard.tsx             # Split into step components
      steps/
        SexAgeStep.tsx
        HeightStep.tsx
        WeightStep.tsx
        ActivityGoalStep.tsx
        HabitsStep.tsx
        ReviewStep.tsx
    actions.ts

components/
  ui/                                  # Primitive design-system (keep as-is, mostly fine)
    Button.tsx
    Card.tsx
    Modal.tsx
    ...
  shared/                              # Cross-feature composed components
    Sidebar.tsx                        # Refactor: server shell + client active-state island
    MobileNav.tsx                      # Same pattern

lib/                                   # Keep as-is — well-organized
hooks/                                 # Keep as-is
services/                              # NEW: WebView bridge service
  webview-bridge.ts                    # Centralized AndroidBridge interaction
types/
constants/
```

### Dependency Direction

```
app/ → features/ → components/ui, components/shared, lib/
         ↓
      components/ui ← never imports from features/
```

- `app/` pages: composition + data fetching only, delegates to `features/`
- `features/<name>/components/`: server components by default
- `features/<name>/components/client/`: explicit client islands with `'use client'`
- `features/<name>/actions.ts`: Server Actions for mutations
- `components/ui/`: zero business logic, no feature imports

---

## 7 · Prioritization Matrix

| Recommendation | Impact | Effort | Priority |
|---------------|--------|--------|----------|
| Add `loading.tsx` / `error.tsx` / `not-found.tsx` per route | 🟢 High — eliminates white flashes, adds error recovery | 🟢 Low — boilerplate files | **P0 — Quick Win** |
| Fix missing `manifest.json` (404 on every load) | 🟢 High — eliminates 404 noise | 🟢 Low — single file | **P0 — Quick Win** |
| Add `viewport-fit: cover` to viewport export | 🟢 High — enables safe-area insets | 🟢 Low — one line | **P0 — Quick Win** |
| Add `overscroll-behavior: none` to body | 🟢 Medium — prevents WebView rubber-band | 🟢 Low — one line CSS | **P0 — Quick Win** |
| Replace `100vh` with `100dvh` in CoachClient | 🟢 Medium — fixes keyboard layout jump | 🟢 Low — one line | **P0 — Quick Win** |
| Replace `window.location.href` with `router.push` + `router.refresh` | 🟢 High — eliminates full reloads in WebView | 🟢 Low — 4 locations | **P0 — Quick Win** |
| Extract server components from dashboard widgets | 🔴 Critical — largest bundle reduction | 🟡 Medium — requires splitting ~5 components | **P1 — Core** |
| Introduce Server Actions for mutations | 🟠 High — eliminates API round-trips, enables optimistic UI | 🟡 Medium — refactor per feature | **P1 — Core** |
| Decompose god components (WeeklySplitMap, RecordWorkout, CoachClient) | 🟠 High — maintainability + bundle splitting | 🔴 High — 3 large refactors | **P2 — Structural** |
| Lazy-load recharts with `next/dynamic` | 🟡 Medium — ~200KB off critical path | 🟢 Low — 2 files | **P1 — Core** |
| Create `features/` directory structure | 🟡 Medium — long-term maintainability | 🟡 Medium — file moves | **P2 — Structural** |
| Refactor UserContext placement (push down from layout) | 🟡 Medium — reduces hydration scope | 🟡 Medium — requires restructuring layout | **P2 — Structural** |
| Add View Transitions for route navigation | 🟡 Medium — native-feeling transitions in WebView | 🟡 Medium — per-route implementation | **P3 — Polish** |
| WebView back-button interception for modals | 🟡 Medium — prevents accidental navigation | 🟡 Medium — bridge coordination | **P3 — Polish** |

---

## 8 · Phased Roadmap

### Phase 1 — Quick Wins (1-2 days)

**Done condition**: Zero 404s for manifest, all routes have `loading.tsx`/`error.tsx`, no `100vh`, no `window.location.href` reloads, viewport-fit=cover active.

#### 1.1 — Route-level loading/error/not-found

Create these files (copy the existing inline `<Suspense>` fallback pattern):

| File to Create | Content |
|---------------|---------|
| `app/(app)/loading.tsx` | Spinner skeleton matching current Suspense fallbacks |
| `app/(app)/error.tsx` | `'use client'` error boundary with retry button |
| `app/(app)/not-found.tsx` | Branded 404 with link back to dashboard |
| `app/(auth)/loading.tsx` | Auth page skeleton |
| `app/(admin)/admin/loading.tsx` | Admin skeleton |
| `app/not-found.tsx` | Root 404 |
| `app/error.tsx` | Root error boundary |

#### 1.2 — Fix manifest.json

Create `public/manifest.json`:
```json
{
  "name": "AI Fit Tracker",
  "short_name": "FitTracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": []
}
```

#### 1.3 — Viewport meta fix

In [app/layout.tsx](file:///d:/fit-tracker/app/layout.tsx), add `viewportFit: "cover"`:
```diff
 export const viewport: Viewport = {
   themeColor: "#09090b",
   width: "device-width",
   initialScale: 1,
   maximumScale: 1,
   userScalable: false,
+  viewportFit: "cover",
 };
```

#### 1.4 — CSS: overscroll + 100vh

In [globals.css](file:///d:/fit-tracker/app/globals.css):
```diff
 body {
   background-color: var(--background);
   color: var(--foreground);
+  overscroll-behavior: none;
 }
```

In [CoachClient.tsx](file:///d:/fit-tracker/components/coach/CoachClient.tsx):
```diff
- <div className="flex flex-col h-[calc(100vh-8rem)] ...">
+ <div className="flex flex-col h-[calc(100dvh-8rem)] ...">
```

#### 1.5 — Replace `window.location.href` with router navigation

4 files need updating — replace hard navigation with `router.push()` + `router.refresh()`:
- [Sidebar.tsx:18](file:///d:/fit-tracker/components/shared/Sidebar.tsx)
- [OnboardingFlow.tsx:183](file:///d:/fit-tracker/components/onboarding/OnboardingFlow.tsx)
- [AdminSidebar.tsx:25](file:///d:/fit-tracker/components/admin/AdminSidebar.tsx)
- [AdminMobileNav.tsx:22](file:///d:/fit-tracker/components/admin/AdminMobileNav.tsx)

---

### Phase 2 — Server/Client Boundary Optimization (3-5 days)

**Done condition**: Dashboard first-paint JS reduced by ≥40%. `MetricsGrid`, `RecentPRsWidget`, workout list cards render as server components. Recharts lazy-loaded.

#### 2.1 — Convert presentational widgets to server components

**Before/After Example 1: RecentPRsWidget**

BEFORE — [RecentPRsWidget.tsx](file:///d:/fit-tracker/components/dashboard/RecentPRsWidget.tsx) (entire component is `'use client'`):
```tsx
"use client";

import React from "react";
import Link from "next/link";
import { Trophy, ChevronRight, TrendingUp } from "lucide-react";

export interface IRecentPR {
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  oneRM: number;
  dateString: string;
  workoutId: string;
  workoutName: string;
}

export function RecentPRsWidget({ prs }: { prs: IRecentPR[] }) {
  // ... renders a list of PRs with Link components
  // NO useState, NO useEffect, NO event handlers beyond Link clicks
  return (
    <div className="p-5 rounded-3xl ...">
      {prs.map((pr) => (
        <Link href={`/workouts/${pr.workoutId}`} key={...}>
          {/* static rendering */}
        </Link>
      ))}
    </div>
  );
}
```

AFTER — remove `'use client'`, file becomes a server component:
```tsx
// No "use client" directive — this is a server component
import React from "react";
import Link from "next/link";
import { Trophy, ChevronRight, TrendingUp } from "lucide-react";

export interface IRecentPR { /* same */ }

export function RecentPRsWidget({ prs }: { prs: IRecentPR[] }) {
  // Identical JSX — no changes needed
  // Link works in server components, lucide icons are pure SVG
  return (/* same JSX */);
}
```

**Impact**: This component's ~4KB of JS is eliminated from the client bundle entirely. The HTML is rendered on the server and streamed. Zero hydration cost.

---

**Before/After Example 2: MetricsGrid + QuickLogModal split**

BEFORE — [MetricsGrid.tsx](file:///d:/fit-tracker/components/dashboard/MetricsGrid.tsx) (10KB, `'use client'`):
```tsx
"use client";

import React, { useState } from "react";
import { QuickLogModal } from "./QuickLogModal";
// ... renders 4 metric cards (calories, protein, steps, water)
// The ONLY client need is the QuickLogModal trigger button

export function MetricsGrid({ stats }: { stats: Stats }) {
  const [showQuickLog, setShowQuickLog] = useState(false);
  
  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 4 static metric cards */}
        <button onClick={() => setShowQuickLog(true)}>Quick Log</button>
      </div>
      <QuickLogModal isOpen={showQuickLog} onClose={() => setShowQuickLog(false)} />
    </>
  );
}
```

AFTER — split into server `MetricsGrid` + tiny client `QuickLogTrigger`:
```tsx
// features/dashboard/components/MetricsGrid.tsx — SERVER COMPONENT
import React from "react";
import { QuickLogTrigger } from "./client/QuickLogTrigger";

export function MetricsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 4 static metric cards — server rendered, zero JS */}
      <div className="p-5 rounded-3xl bg-zinc-900/80 ...">
        <span>{stats.caloriesIn.toLocaleString()}</span>
        {/* ... */}
      </div>
      {/* ... 3 more cards */}
      
      {/* Client island — only this button + modal hydrate */}
      <QuickLogTrigger waterMl={stats.waterMl} />
    </div>
  );
}
```

```tsx
// features/dashboard/components/client/QuickLogTrigger.tsx — CLIENT
"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

const QuickLogModal = dynamic(() => 
  import("./QuickLogModal").then(m => ({ default: m.QuickLogModal })),
  { ssr: false }
);

export function QuickLogTrigger({ waterMl }: { waterMl: number }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button onClick={() => setShowModal(true)}>Quick Log</button>
      {showModal && (
        <QuickLogModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          initialWaterMl={waterMl}
        />
      )}
    </>
  );
}
```

**Impact**: ~10KB MetricsGrid + ~20KB QuickLogModal removed from initial client bundle. QuickLogModal only loads when user clicks the trigger.

#### 2.2 — Lazy-load recharts

```tsx
// features/dashboard/components/client/EnergyBalanceChartClient.tsx
"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const EnergyBalanceChart = dynamic(
  () => import("./EnergyBalanceChartInner"),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      </div>
    ),
  }
);

export { EnergyBalanceChart };
```

Apply same pattern to `WeightTrendWidget`.

#### 2.3 — Server-side Settings page

Refactor `/settings` to pass user data as server props instead of reading from `UserContext`:

```tsx
// app/(app)/settings/page.tsx — AFTER
import { getFullUser } from "@/lib/auth/session";
import { SettingsForm } from "@/features/settings/components/client/SettingsForm";

export default async function SettingsPage() {
  const user = await getFullUser();
  const sanitized = JSON.parse(JSON.stringify(user));
  return <SettingsForm initialUser={sanitized} />;
}
```

---

### Phase 3 — Server Actions + God Component Decomposition (5-8 days)

**Done condition**: Mutation flows use Server Actions. WeeklySplitMap, RecordWorkoutClient, CoachClient each decomposed into ≤200 LOC sub-components.

#### 3.1 — Introduce Server Actions

Create `features/<feature>/actions.ts` files with `"use server"` directive for each mutation:

```tsx
// features/dashboard/actions.ts
"use server";

import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import { revalidatePath } from "next/cache";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function logWater(amountMl: number) {
  const user = await getFullUser();
  if (!user) throw new Error("Unauthorized");
  
  await getDb();
  const todayStr = getTodayDateString();
  
  await DailyLog.findOneAndUpdate(
    { userId: user._id, dateString: todayStr },
    { $inc: { waterMl: amountMl } },
    { upsert: true }
  );
  
  revalidatePath("/");
}
```

Replace the corresponding `fetch('/api/...')` + `router.refresh()` calls in client components with direct action invocation.

#### 3.2 — Decompose god components

**WeeklySplitMap (955 LOC)** → split into:
- `WeeklySplitMapServer.tsx` — server: renders day cards, volume stats, muscle breakdown
- `WeeklySplitMapClient.tsx` — client: routine editor modal, day assignment drag
- `RoutineEditorModal.tsx` — client: the editing modal (extracted)
- `MuscleVolumeBar.tsx` — server: individual muscle progress bar
- `DayCard.tsx` — server: individual day display

**RecordWorkoutClient (750 LOC)** → split into:
- `RecordWorkoutShell.tsx` — client: page-level state + layout
- `DaySelector.tsx` — client: day-of-week picker
- `ExerciseListPanel.tsx` — client: exercise list with add/remove
- `SetEditor.tsx` — client: individual set row editing (already partially done as `SetRow`)
- `SaveWorkoutAction.ts` — server action for persistence

**CoachClient (748 LOC)** → split into:
- `ChatContainer.tsx` — client: scroll container + message list
- `MessageBubble.tsx` — shared: individual message rendering
- `ChatInput.tsx` — client: input + send button
- `CommandPalette.tsx` — client: slash command picker
- `DataContextBadge.tsx` — server: data summary display

---

### Phase 4 — Android WebView Optimization (2-3 days)

**Done condition**: View Transitions active on supported WebViews, back button intercepted for modals, external links open system browser, WebView testing checklist validated on mid-range device.

#### 4.1 — View Transitions

Next.js 16.3.1 with React 19.2.8 supports `<ViewTransition>` natively. Available in Chromium 125+ (most Android WebViews updated since 2024). Implement with progressive enhancement:

```tsx
import { ViewTransition } from "react";

// In layout.tsx or page transitions:
<ViewTransition name="page-content">
  {children}
</ViewTransition>
```

Feature-detect in a client wrapper:
```tsx
const supportsViewTransitions = typeof document !== "undefined" 
  && "startViewTransition" in document;
```

#### 4.2 — Back button interception

Create `services/webview-bridge.ts`:
```tsx
export function interceptBackButton(onBack: () => boolean) {
  // Return true if modal/drawer was closed, false to allow navigation
  if (typeof window !== "undefined" && window.AndroidBridge) {
    window.addEventListener("popstate", (e) => {
      if (onBack()) {
        e.preventDefault();
        history.pushState(null, "", location.href);
      }
    });
  }
}
```

Apply to Modal, Drawer, and Sheet components.

#### 4.3 — External link handling

Add `target="_blank" rel="noopener"` to external links, and coordinate with Android `shouldOverrideUrlLoading` to open system browser.

#### 4.4 — GPU/compositing audit

The `glass-surface` and `glass-panel` classes in globals.css use `backdrop-filter: blur(16px)` / `blur(20px)`. These are expensive on low-end WebView GPU compositing. Add a media query fallback:

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-surface { backdrop-filter: none; background-color: rgba(24, 24, 27, 0.95); }
  .glass-panel { backdrop-filter: none; background-color: rgba(9, 9, 11, 0.98); }
}
```

---

### Phase 5 — Feature Directory Migration (3-5 days)

**Done condition**: `features/` directory structure in place. Components organized by feature with clear server/client separation.

Move files into `features/<feature>/` structure. This is a pure organizational change with no behavioral impact — do it route-by-route:

1. `features/dashboard/` ← `components/dashboard/`
2. `features/workout/` ← `components/workout/`
3. `features/nutrition/` ← `components/nutrition/`
4. `features/body-comp/` ← `components/body-comp/`
5. `features/coach/` ← `components/coach/`
6. `features/settings/` ← `components/settings/`
7. `features/onboarding/` ← `components/onboarding/`
8. `features/auth/` ← `components/auth/`
9. `features/admin/` ← `components/admin/`

Update import paths (tsconfig `@/features/*` alias). Each move is independently revertable.

---

## 9 · Performance Validation Targets

### Bundle Size Targets (per route, client JS)

| Route | Current (est.) | Target | Reduction |
|-------|---------------|--------|-----------|
| `/` (Dashboard) | ~350KB | ≤180KB | ~50% |
| `/workouts` | ~120KB | ≤60KB | ~50% |
| `/workouts/record` | ~180KB | ≤140KB | ~22% |
| `/nutrition` | ~100KB | ≤50KB | ~50% |
| `/coach` | ~160KB | ≤130KB | ~19% |
| `/settings` | ~80KB | ≤40KB | ~50% |

*Measure with `@next/bundle-analyzer` after each phase.*

### Core Web Vitals Targets (Mobile)

| Metric | Target |
|--------|--------|
| LCP | ≤ 2.0s |
| FID/INP | ≤ 150ms |
| CLS | ≤ 0.05 |
| TTFB | ≤ 400ms |
| TTI (WebView, mid-range) | ≤ 3.5s |

### Phase "Done" Conditions

| Phase | Measurable Condition |
|-------|---------------------|
| Phase 1 | Zero 404 for manifest; all routes have loading/error/not-found; `lighthouse --preset=perf` shows no "Avoid `100vh`" warning; no `window.location.href` in codebase |
| Phase 2 | `@next/bundle-analyzer` shows dashboard route client JS ≤ 180KB; `RecentPRsWidget` and `MetricsGrid` absent from client bundles; recharts loaded lazily |
| Phase 3 | Zero `fetch('/api/...')` for CRUD mutations in dashboard/workout flows; no component file exceeds 300 LOC; Server Actions visible in React DevTools |
| Phase 4 | `<ViewTransition>` wraps main content area; back button closes open modals before navigating; Chrome remote debug on real WebView shows zero `backdrop-filter` jank at 4x CPU throttle |
| Phase 5 | All feature components live under `features/`; `components/` contains only `ui/` and `shared/`; import cycle checker passes |

---

## 10 · Android WebView Testing Checklist

### Required Test Devices/Configurations

| Config | Why |
|--------|-----|
| Android 13+ with latest WebView (Chromium 125+) | Baseline — View Transitions support |
| Android 11 with WebView from 2023 (Chromium ~110) | Fallback path — no View Transitions |
| Mid-range device (e.g., Samsung A34, Pixel 6a) | Performance floor testing |
| Low-end device (e.g., Samsung A14, Redmi 12) | GPU compositing stress test |

### How to Debug

1. Enable WebView debugging in Android app:
   ```kotlin
   WebView.setWebContentsDebuggingEnabled(true)
   ```
2. Connect device via USB
3. Open `chrome://inspect` in desktop Chrome
4. Select the WebView target under "WebView in com.fittracker.android"
5. Use Performance tab with 4x CPU throttle for low-end simulation

### What to Test

| # | Test | Expected | Watch For |
|---|------|----------|-----------|
| 1 | Cold launch → dashboard | Content visible within 3s on mid-range | White flash before content |
| 2 | Navigate dashboard → workouts → back | Smooth transition, no white flash | Full page reload (network tab shows document request) |
| 3 | Open QuickLogModal → Android back button | Modal closes, stays on dashboard | Navigates back to previous page |
| 4 | Open keyboard on Coach chat input | Chat input stays visible, no layout jump | Content pushed behind keyboard, `100vh` issues |
| 5 | Scroll dashboard rapidly | Smooth 60fps scrolling | Jank, missed frames (Performance panel) |
| 6 | `backdrop-filter` areas while scrolling | No visible lag | Paint storms (enable "Show paint rectangles") |
| 7 | Pull down on page top | No rubber-band / pull-to-refresh | WebView default overscroll behavior |
| 8 | Tap external link (if any) | Opens system browser | Stays trapped in WebView |
| 9 | `position: fixed` MobileNav | Stays pinned at bottom during scroll | Jumps or disappears on scroll (common WebView bug) |
| 10 | Rotate device (if supported) | Layout adjusts, no content cut off | Safe area insets miscalculated |
| 11 | Kill app → reopen | Session persists (cookie-based auth) | Logged out / cookie lost |
| 12 | Airplane mode → navigate | Graceful error or cached content | Infinite spinner, blank page |

---

## 11 · Visual Change Flags

> ⚠️ **The following changes would alter visual output and need explicit approval:**

| Change | Impact | Status |
|--------|--------|--------|
| Adding `overscroll-behavior: none` to body | Removes rubber-band bounce effect on over-scroll — behavioral, not visual | **Needs approval** |
| Adding `backdrop-filter: none` fallback for `prefers-reduced-transparency` | Only affects users who have set "reduce transparency" in OS settings | **Needs approval** |
| Replacing `100vh` with `100dvh` in CoachClient | May slightly change chat container height — should be imperceptible | **Needs approval** |
| Adding `loading.tsx` skeletons per route | New UI shown during navigation — should match existing inline Suspense fallbacks | **Needs approval** |
| Adding `not-found.tsx` branded 404 page | New page that doesn't exist today | **Needs approval** |
| Adding `error.tsx` error boundaries | New error recovery UI | **Needs approval** |

All architectural changes (component splitting, Server Actions, directory restructuring) produce **zero visual output changes** — they affect only the internal structure, hydration behavior, and bundle composition.

---

**Awaiting approval before implementation — no files have been modified.**
