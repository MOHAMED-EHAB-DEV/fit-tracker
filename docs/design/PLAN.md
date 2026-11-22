# FitTracker — full UI/UX redesign

Status: analysis done; design system, functional blueprint, seven app-screen mockups and a landing-page mockup agreed with Gemini 4 Neon and the owner's choices; nothing implemented yet. Large, multi-session job: phases 0–9 (plus 2b for the landing page and route move), each one leaves the app working.

## Context

The owner finds the current UI/UX unprofessional and wants everything changed to a professional, simple, minimal design that is easy to use. The codebase was analysed first (three read-only explorers + direct reads); the visual direction is being developed together with Gemini 4 Neon, whose proposals are reviewed against the code before anything is adopted.

Stack (verified): Next.js 16.3 App Router, React 19.3, Tailwind CSS 4.3 configured CSS-first in `app/globals.css` (`@theme`), `lucide-react`, visx charts, MongoDB/Mongoose, custom JWT auth, PWA + Android WebView wrapper (`FitTrackerAndroid/`). No component kit, no animation library, no i18n (English only, partly RTL-safe). Dark-only.

## Findings: what is wrong today

Visual system
- Tokens exist (`app`, `surface`, `surface-2`, `line`, `ink`, `brand`, …) but are almost unused: ~2,500 raw palette classes vs ~108 token uses; `brand`, `on-brand`, `danger`, `warning`, `ink-muted` have 0 uses.
- ~100 hand-built card `<div>`s (5 border colours, 9+ backgrounds, radii 2xl/3xl/28px); `components/ui/Card.tsx` has 2 importers.
- 171 raw `<button>`s in 58 files; 36 re-create the primary button by hand; `Button` itself is 5 variants × 3 sizes × 5 radii.
- 18 radius classes, 10 coloured shadows, 12 white-opacity borders, 5 font weights incl. `font-black`; 11 hues in use (zinc, emerald, red, amber, violet, teal, rose, orange, cyan, blue, sky).
- "Glassy dashboard" look: `backdrop-blur`, dark drop shadows, gradient progress bars, one accent colour per metric, uppercase micro-labels, extra-bold numerals.
- Outside the system: `components/ui/Toast.tsx` (inline JS styles, hex), the three visx charts (hex in JS), 4 popover implementations, violet "FitAdmin" admin area, `animate-in …` classes that do nothing (plugin not installed).

UX
- Today (`app/(app)/page.tsx`): 11 sections, 15+ competing actions, no primary action; water in three places; two overlapping quick-entry overlays (`QuickActionsSheet`, `QuickLogModal`).
- Live workout (`components/workout/SessionScreen.tsx`, 1002 lines): tab bar stays visible; rest-timer and undo bars stack above it and hide each other; Finish is top-right, Discard at the bottom of the scroll; no steppers; Enter does not advance weight → reps; set type / RPE / delete each need a drawer (3 taps); toasts appear at the top.
- Inconsistent patterns: 5 confirm patterns (one destructive action has none), 3 undo bars, 3 tick styles, 2 number inputs, spinners vs skeletons, "over target" red on Today but amber on Eat.
- Naming: nav labels ≠ page titles (Eat/"Nutrition", Habits/"Daily Life Habits", Body/"Body Composition & Physique"); photo-meal logging has 8 names; US/UK spelling mix; Title Case mixed with sentence case.
- Navigation: Planner, Habits, Body, Coach hidden behind "More"; desktop has no quick-add; no shared page header.
- Works well and must be kept: ghost-value prefill + 1-tap set logging, autosave with offline draft, wake lock, wall-clock rest timer, undo on deletes, focus-trapped `Modal`/`Drawer`, safe-area handling, reduced-motion support.

## Design direction — "Calibrated Matte, glass chrome"

Owner decisions (2026-11-21): direction approved with "some glass" added; Dark + Light; accent = cobalt; restructure approved; redesign covers functionality, not only looks; add a full public landing page at `/` and move the signed-in home to `/dashboard`.

Source of truth: the Gemini 4 Neon chat "FitTracker UI Redesign Partnership" in AI Studio. Two static HTML mockups (no scripts, CSS-only Dark/Light + accent switcher): (1) Today, live session, Finish sheet — with glass; (2) Train/Workouts with the minimised live bar, Eat/Day with a Suggested scan, Plan/Habits, Body, and the new app icon (barbell + calibrated index, ink on carbon with a cobalt notch). (3) the responsive landing page (header, hero with Today + live-session vignettes, feature rows, Android, data, FAQ, footer). Phase 0 saves all three files into the repo. The landing mockup predates the owner's price answer: the build adds the "free, shared limited AI quota, bring your own key" line under the hero buttons and as an FAQ entry.

Principles
1. Monochrome structure, earned colour: neutral surfaces, hairlines, ink. `accent` marks only what is live now (running timer, active set, current tab, today's bar).
2. Done = solid/quiet ink, never a green fill. Status colours (ok / warn / danger) appear as text or icon only.
3. One job per screen, one primary action per viewport.
4. Typography over containers: hairline-divided rows instead of nested cards.
5. Three radii: card 14px, control 10px, chip 6px (+ full for dots/avatars).
6. Matte content, glass chrome: glass only on layers that float over scrolling content — tab bar, session dock, minimised-workout bar, sticky top bars when scrolled, sheets / dialogs / popovers / toasts. Cards, rows, inputs, buttons, charts stay matte. Solid fallback when `backdrop-filter` is unsupported or reduced transparency is requested.
7. Thumb ergonomics: 48px+ targets in the session, 44px elsewhere, 16px inputs, numerals readable at arm's length.

Tokens (exact, from the mockup)

| Token | Dark | Light |
|---|---|---|
| canvas / surface / elevated / recessed | `#0C0D0F` / `#141619` / `#1C1F24` / `#090A0C` | `#F5F4F0` / `#FFFFFF` / `#ECEAE2` / `#E6E3DA` |
| border subtle / strong | `#242830` / `#373D48` | `#E1DED5` / `#C5C0B4` |
| ink primary / secondary / muted / inverse | `#F2F4F7` / `#9CA3AF` / `#7C8594` / `#0C0D0F` | `#171715` / `#57564F` / `#6A685F` / `#FFFFFF` |
| accent (cobalt) / soft | `#4C82FB` / 14% | `#2563EB` / 10% |
| ok / warn / danger | `#3FB978` / `#E5A93C` / `#E85454` | `#1D7A4C` / `#B4690E` / `#C4322B` |
| glass chrome bg / sheet bg | `rgb(16 18 22 / .82)` / `rgb(20 22 26 / .88)` | `rgb(245 244 240 / .84)` / `rgb(255 255 255 / .90)` |
| glass blur chrome / sheet | `blur(20px) saturate(160%)` / `blur(24px) saturate(170%)` | `blur(20px) saturate(140%)` / `blur(24px) saturate(150%)` |
| glass border / specular lip | `rgb(255 255 255 / .09)` / `inset 0 1px 0 rgb(255 255 255 / .10)` | `rgb(23 23 21 / .10)` / `inset 0 1px 0 rgb(255 255 255 / .85)` |
| glass live tint / scrim (unblurred) | `rgb(76 130 251 / .08)` / `rgb(6 7 9 / .58)` | `rgb(37 99 235 / .06)` / `rgb(23 23 21 / .34)` |
| glass fallback chrome / sheet | `#111317` / `#16181D` | `#F5F4F0` / `#FFFFFF` |

Type: IBM Plex Sans for every word (≥12px, sentence case, no forced uppercase); IBM Plex Mono with `tabular-nums` only for numerals that tick or align (timers, set table, metrics, chart axes). Both via `next/font/google`. User-chosen colours (habits, planner categories) render only as a 3px leading bar.

To verify during build: muted ink on `elevated` in dark is ~4.4:1 — nudge to ≥4.5:1.

## Functional redesign (agreed with Gemini, checked against the code)

Global grammar
- Navigation: phone tab bar = Today · Train · Eat · Plan · Body (flat, glass). Shared page header on every screen: title (= tab label; Today shows the date), Coach button, profile menu (Settings, Admin for admins, Widgets on Android, Sign out). The centre (+), the "More" drawer, `QuickActionsSheet` and `QuickLogModal` are removed. Desktop: 224px rail (Today, Train, Eat, Planner, Habits, Body · Coach · Settings/account).
- Logging: tap the number you want to change → small sheet/popover → saves at once → Undo toast in the thumb zone. No long-press anywhere.
- Overlays: Sheet for tasks (bottom on phones, centred 480px dialog on desktop); Popover for small choices; Confirm only for irreversible actions; reversible deletes are instant with a 7s Undo.
- One vocabulary: Start workout, Resume, Log set, Log meal, Scan meal, Log weight, Check in. Sentence case, one spelling.
- Loading = skeletons; errors inline with Retry; AI output = dashed "Suggested" container with Accept / Dismiss.

Per area
- Today: adaptive workout hero (planned / in progress / done / rest day / nothing planned) → fuel ledger (kcal left, protein-carbs-fat, steps, water +250 with Undo; tap a value to edit) → next up and habits (checkable inline) → meals today (latest 3 + Log meal). Streak = header chip with popover (current, best). Moved out: weekly training stats → Train/History; energy balance → Eat/Week; weight trend → Body.
- Train: segmented Workouts | History | Exercises. Workouts = today's bar, 7-day strip (tap a day to assign routine/rest), routines list with Start, New routine. History = weekly insights (sets per muscle group, volume, PRs) above the session list. Exercises = new library page (search, filters, edit/delete custom exercises — API exists, no UI today), exercise detail with records, history, new progress chart.
- Live session (focus mode, no tab bar): top bar (minimise · name, elapsed, sync · menu with Workout note, Reorder, Discard) → progress hairline → full-bleed ledger (Set | Prev | value columns | tick; done rows quiet, active row accented, finished/other exercises collapsed) → glass dock: rest timer or Undo strip + Finish (secondary) + "Log set N · W × R" (primary; becomes "Finish workout" when all sets are ticked). Set badge opens a popover (type, RPE, delete). Keypad accessory bar above the keyboard: steppers (±2.5 / ±1) and Next (weight → reps → log). Finish = one sheet → summary with PRs and a Suggested diff to update routine targets. Routine editor uses the same table and popover.
- Eat: Day | Week. Day = date navigator, ledger (no steps), Log meal + Scan meal, one chronological meal list (menu: Edit, Log again, Delete with Undo). Add-meal sheet: Manual (name, kcal, protein; "More details" for carbs, fat, type, ingredients) or Scan (photo → Suggested estimate → edit → save). Week = 7-day averages, energy-balance chart, daily rows.
- Plan: Schedule | Habits on the existing `/planner` and `/habits` routes. Schedule = week strip, timeline, event sheet (replaces the left drawer), "Plan my day" returning Suggested events accepted one by one. Habits = checklist rows (colour bar, emoji, 7-day dots, tick), consistency chart below, archive with Undo.
- Body: weight hero (latest, 30-day delta, 30d | 90d chart with 7-day average line), Log weight (one field) + Check in (full form; AI estimate as Suggested), history rows. Deleting a check-in with photos stays a Confirm.
- Coach: full-height chat from the header; route-aware suggestion chips (slash commands still work); proposals as Suggested cards → "Applied".
- Settings: three groups of rows (Body and targets · Preferences incl. Appearance System/Light/Dark · Account and data); each row opens its own sheet with inline validation and Save (no floating unsaved bar, no browser confirm).
- Onboarding / auth: same steps, restyled, per-field errors, one set of limits.
- Admin: same system, no violet theme; done last.

Later phase (designed, not in the first pass): supersets UI, quick-repeat meals (needs one read-only aggregation route), barbell plate math in the keypad bar.

Landing page and route move (owner request, 2026-11-21)
- `/` becomes a public, indexed landing page; the signed-in home (Today) moves to `/dashboard`.
- Owner's content decisions: primary button "Get started" → `/signup`, secondary "Sign in"; "Get the Android app" → the releases URL already in `services/webview-bridge.ts` (`ANDROID_RELEASES_URL`; only works for visitors if that repository is public); price line: free to use, AI features run on a shared limited quota, add your own Gemini key in Settings to lift the limit. No invented numbers, testimonials or awards.
- Structure (Gemini mockup, same design system): sticky glass header → hero with real UI vignettes (HTML/CSS, no screenshots) → feature rows (Train, Eat, Plan, Body, Coach) → gym-floor facts → "AI that asks first" → Android extras → your data → FAQ → final call to action and footer. Server-rendered, no client JavaScript beyond the theme switch.

## Implementation plan

Rules: read the matching guide in `node_modules/next/dist/docs/` before each area (fonts, css, metadata/viewport, view-transitions). Never touch the `.env` database; run only through `node scripts/dev-local.mjs`. No commits unless the owner asks. Every phase ends green and leaves the app usable (old raw-palette screens keep working until their phase).

Phase 0 — References and guard
- Work on a new branch `redesign/calibrated-matte` (branch only; commits when the owner says).
- Save Gemini's three mockup HTML files and a short spec to `docs/design/` (empty folder today).
- `scripts/check-design-tokens.mjs` (+ `lint:tokens`): reports raw palette classes / hex in `app`, `components`; allowlist shrinks per phase; becomes a CI error in Phase 9.

Phase 1 — Foundation
- `app/globals.css`: token layer (light default; dark via `prefers-color-scheme` and `[data-theme]`), `@theme inline` mappings (`canvas, surface, elevated, recessed, line, line-strong, ink, ink-2, ink-3, ink-inverse, accent, accent-soft, ok, warn, danger`), radii, fonts, `glass-chrome` / `glass-sheet` utilities with fallbacks, focus ring, skeleton, motion. Keep the existing safe-area / overlay / reduced-motion rules.
- `app/layout.tsx`: IBM Plex Sans + Mono via `next/font/google`; drop forced `dark`; pre-paint theme script (CSP has no `script-src`, so inline is allowed); `viewport.themeColor` per scheme.
- `lib/ui/theme.ts`, `hooks/useTheme.ts` (localStorage, meta theme-color sync).
- `components/ui/` on tokens: `Button` (primary / secondary / ghost / danger; 44 / 48), `IconButton`, `Surface`, `List`/`ListRow`, `SectionHeader`, `PageHeader`, `SegmentedControl`, `Tick`, `ProgressTrack`, `Stat`, `Chip`, field kit (`Input`, `Textarea`, `Select`, `NumberField` + steppers, `Checkbox`, `field-styles.ts`), `Sheet` (new; `Modal` and `Drawer` become thin wrappers so their 23 call sites keep working; reuses `hooks/useDialogOverlay`, `lib/ui/overlay-stack.ts`), `Popover` (one implementation replacing four), `ConfirmDialog`, `Toast` (rewritten: classes, bottom position, action for Undo), `Skeleton`, `EmptyState`, `SuggestedCard`.
- `hooks/useUndoableDelete.ts` (optimistic remove, 7s deferred commit, flush on pagehide) replacing the three home-made undo bars; `lib/ui/chart-theme.ts` (chart colours from CSS variables).

Phase 2 — Shell
- `constants/navigation.ts` (tabs, rail, profile menu); `components/shared/TabBar.tsx` (replaces `BottomNav`; hidden on `/workouts/session/*`), `NavRail.tsx` (replaces `Sidebar`), `ProfileMenu`, glass `ActiveSessionBar`; `app/(app)/layout.tsx` container widths (1120 / session 680); generic `loading.tsx` skeletons; `public/offline.html`, `public/manifest.json` colours.

Phase 2b — Route move and landing page
- Move `app/(app)/page.tsx` → `app/(app)/dashboard/page.tsx`; new `app/(marketing)/layout.tsx` + `page.tsx` (landing) and `components/marketing/*` (header, hero, feature rows, UI vignettes built from the Phase 1 primitives, FAQ, footer).
- `proxy.ts`: `/` is public; a signed-in visitor on `/` is redirected to `/dashboard` (keeps installed PWAs and the Android app, whose start URL is `/`, working); signed-in visitors on `/login` / `/signup` go to `/dashboard`.
- Every "home" reference → `/dashboard`: `constants/navigation.ts` (+ `isNavItemActive` special case), `components/auth/LoginForm.tsx`, `app/onboarding/page.tsx`, `components/onboarding/OnboardingFlow.tsx`, `lib/auth/admin.ts`, `app/not-found.tsx`, `app/(app)/not-found.tsx`, `components/nutrition/PhotoAnalyzer.tsx`, admin "Back to app" links, `revalidatePath("/")` in `lib/nutrition/actions.ts`, `public/manifest.json` (`start_url`; `id` stays `/` so installs are not duplicated).
- Signed-out users inside the installed PWA or the Android app must see sign-in, not marketing: a small client check on the landing (standalone display mode or the native bridge from `hooks/useIsNativeApp`) replaces to `/login`; Android `AppConfig.startUrl` → `/dashboard` for the next APK (cannot be compiled here).
- SEO: landing overrides the global `robots: noindex` (app pages stay noindex); title, description, Open Graph image (`opengraph-image`), `app/robots.ts` + `app/sitemap.ts` listing only `/`.

Phase 3 — Today: `app/(app)/dashboard/page.tsx` + `components/dashboard/*` → `WorkoutHero`, `FuelLedger` (shared with Eat), `WaterCell`, `StepsCell`, `RhythmList`, `MealsToday`, `StreakChip`. Keep the Android `syncWidgetData` call that lives in `MetricsGrid` today. Reuse `lib/dashboard/metrics.ts`, `lib/fitness/streak.ts` (`longestStreak` already computed), `logWaterAction`.

Phase 4 — Train: split `TrainHub.tsx` (860), `SessionScreen.tsx` (1002), `RoutineEditor.tsx` (840) into the pieces above; new `/workouts/exercises`; selectors `activeSet` / `nextOpenSet` added to `lib/workouts/session-state.ts` with tests in `tests/session-state.test.ts`; sync stays in `session/useSessionSync.ts`; keypad bar positioned with the existing visual-viewport tracking.

Phase 5 — Eat: `app/(app)/nutrition/page.tsx` Day | Week; `AddMealSheet` merging `MealFormDialog`, `EditMealModal`, `PhotoAnalyzer` (route `/nutrition/analyze` kept as a deep link); `EnergyBalanceChart` moved and tokenised (`lib/dashboard/energy.ts` reused).

Phase 6 — Plan: `PlanTabs`; `EventSheet` (replaces `EventDrawer` + `AddEventModal`); `HabitRow` list; delete dead `AddHabitModal`, `EditHabitModal`.

Phase 7 — Body: split `BodyCompClient.tsx` (576) → `WeightHero`, `LogWeightSheet`, `CheckInSheet`, history; moving-average helper next to `lib/dashboard/weight.ts` with a test.

Phase 8 — Coach, Settings, onboarding, auth: split `CoachClient.tsx` (1015) and `SettingsClient.tsx` (821) as described; Appearance setting; one validation source for profile limits.

Phase 9 — Admin, brand, cleanup: admin on shared primitives; new icon (`public/icons/icon.svg` + PNGs, favicon); Android native colours and light status bar are edited but cannot be compiled here — flagged for the next APK build; delete dead components and CSS; token guard becomes an error in `.github/workflows/ci.yml`; README design section.

Review checkpoints for the owner: after Phase 2b (shell, primitives, landing page and route move visible), after Phase 4 (Today + Train complete), then per phase.

## Verification

Per phase
- `bun run typecheck`, `bun run lint`, `bun run test` (277 tests today; new tests for selectors, moving average), `next build` through `node scripts/dev-local.mjs --prod`.
- Browser pass against `fit-tracker-local` (`.claude/launch.json`, port 3100, in-memory DB, demo account): phone 390×844 and desktop 1280, dark and light, each flow touched in the phase clicked end to end (start → log sets → rest → finish; log / scan / edit / delete meal with Undo; habits; check-in; settings save).
- Route move: signed-out `/` shows the landing; signed-in `/` lands on `/dashboard`; login, signup → onboarding → `/dashboard`; old bookmarks and the manifest start URL still open the app; landing is indexable while app pages stay noindex (check response meta/headers); landing renders with JavaScript disabled.
- Checks: no console errors; focus trap and Escape in sheets; keyboard-only pass; reduced motion; contrast of every ink/surface pair ≥ 4.5:1 (script); `backdrop-filter` fallback; `lint:tokens` count goes down each phase and is zero at the end.
- Not verifiable here (stated, not assumed): real AI answers, real photo uploads, Android WebView rendering and native changes.
