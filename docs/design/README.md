# FitTracker redesign — design spec

"Calibrated Matte, glass chrome". Agreed on 2026-11-21 between the owner, Claude and Gemini 4 Neon (AI Studio chat "FitTracker UI Redesign Partnership"). `PLAN.md` in this folder is the approved build plan; this file holds the design detail the plan refers to.

## Files in this folder

- `PLAN.md` — approved plan: findings, phases, verification.
- `mockup-app-core.html` — Today, live session, Finish sheet (glass applied).
- `mockup-app-screens.html` — Train/Workouts with the minimised live bar, Eat/Day with a Suggested scan, Plan/Habits, Body, new app icon.
- `mockup-landing.html` — responsive landing page.

The mockups are static HTML (no scripts) with a CSS-only Dark/Light and accent switcher at the top. Their CSS is the reference for exact sizes. Where this file and a mockup disagree, the mockup wins for visuals and this file wins for behaviour. Screens without a mockup (Train History, Exercises, exercise detail, routine editor, Eat Week, Plan Schedule, Coach, Settings, onboarding, auth, admin, desktop layouts) follow the same components and the structures below.

## Principles

1. Monochrome structure, earned colour. Neutral surfaces, hairlines and ink. `accent` marks only what is live now: running timer, active set row, current tab, today's bar.
2. Done is ink, never a green fill. Status colours appear as text or icon only.
3. One job per screen, one primary action per viewport.
4. Typography over containers: hairline-divided rows, not cards inside cards.
5. Three radii, no arbitrary values.
6. Matte content, glass chrome (closed list below).
7. Thumb ergonomics: 48px+ targets in the live session, 44px elsewhere, 16px inputs, numerals readable at arm's length.

## Tokens

| Token | Dark | Light |
|---|---|---|
| canvas | `#0C0D0F` | `#F5F4F0` |
| surface (cards) | `#141619` | `#FFFFFF` |
| elevated (inputs, secondary buttons) | `#1C1F24` | `#ECEAE2` |
| recessed | `#090A0C` | `#E6E3DA` |
| border subtle / strong | `#242830` / `#373D48` | `#E1DED5` / `#C5C0B4` |
| ink primary / secondary / muted | `#F2F4F7` / `#9CA3AF` / `#7C8594` | `#171715` / `#57564F` / `#6A685F` |
| ink inverse (text on ink) | `#0C0D0F` | `#FFFFFF` |
| accent (cobalt) / accent soft | `#4C82FB` / 14% alpha | `#2563EB` / 10% alpha |
| ok / warn / danger | `#3FB978` / `#E5A93C` / `#E85454` | `#1D7A4C` / `#B4690E` / `#C4322B` |

Radii: card 14px, control 10px, chip 6px, full (dots, avatars, switches).

Spacing: 4px grid; 16px screen padding; 12px between cards; 16px inside cards; 1px hairlines. No drop shadows on matte content: elevation is a tonal step plus a hairline.

Type (IBM Plex Sans 400/500/600; IBM Plex Mono 400/500/600 with `tabular-nums`)

| Role | Family | Size / line | Weight |
|---|---|---|---|
| Display numeral (hero metric, timers) | Mono | 32 / 36, -0.03em | 500 |
| Screen title | Sans | 22 / 28, -0.02em | 600 |
| Section title | Sans | 15 / 20 | 600 |
| Body | Sans | 14 / 20 | 400 |
| Input | Sans or Mono for numerals | 16 / 22 | 400–600 |
| Label, metadata | Sans | 12 / 16 | 500 |

Every word is Plex Sans, at least 12px, sentence case, never forced uppercase. Mono is only for numerals that tick or align in columns: timers, set table, metric values, chart axes.

Controls: primary button 48px high, control radius, ink background with inverse text, 600 14px. Secondary 44px, elevated background with subtle border, 500 14px. Icon button 40px visual with a 44px hit area. One primary button per viewport.

## Glass material

| Token | Dark | Light |
|---|---|---|
| chrome background | `rgb(16 18 22 / 0.82)` | `rgb(245 244 240 / 0.84)` |
| sheet background | `rgb(20 22 26 / 0.88)` | `rgb(255 255 255 / 0.90)` |
| live tint (layered on chrome) | `rgb(76 130 251 / 0.08)` | `rgb(37 99 235 / 0.06)` |
| chrome blur | `blur(20px) saturate(160%)` | `blur(20px) saturate(140%)` |
| sheet blur | `blur(24px) saturate(170%)` | `blur(24px) saturate(150%)` |
| border | `rgb(255 255 255 / 0.09)` | `rgb(23 23 21 / 0.10)` |
| specular top lip | `inset 0 1px 0 rgb(255 255 255 / 0.10)` | `inset 0 1px 0 rgb(255 255 255 / 0.85)` |
| bar shadow | `0 -6px 20px rgb(0 0 0 / 0.32)` | `0 -6px 20px rgb(23 23 21 / 0.06)` |
| sheet shadow | `0 -14px 36px rgb(0 0 0 / 0.52)` | `0 -14px 36px rgb(23 23 21 / 0.12)` |
| scrim (not blurred) | `rgb(6 7 9 / 0.58)` | `rgb(23 23 21 / 0.34)` |
| fallback chrome / sheet | `#111317` / `#16181D` | `#F5F4F0` / `#FFFFFF` |

Allowed on, and only on: the bottom tab bar; the live-session dock (live tint on the rest strip); the minimised-workout bar (live tint); sticky top bars once content scrolls under them; sheets, dialogs, popovers and toasts. Everything else stays matte. Use the solid fallback when `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce` is set.

## Colour rules

- Completed (ticked set, checked habit, met target): ink tick. In the set table a done row is a quiet tile with an ink check and secondary-ink numerals; the active row's tick is the only solid-ink control; pending rows are a hairline outline.
- Over-target calories and PR badges: `warn` text. Errors and destructive actions: `danger` text. Positive sync state and good trends: `ok` text.
- User-chosen colours (habits, planner categories): a 3px leading bar only.
- AI output: dashed hairline container labelled "Suggested" with Accept / Dismiss; never accent-filled; becomes "Applied" after accept.

## Data display

- Progress tracks: 4px (3px small) with fine tick marks at 25 / 50 / 75%, fill in ink. Accent fill only for the live rest timer and "today".
- Charts (visx): 1.5–1.75px strokes, square-cap bars, dashed target line, mono 12px axis labels, colours from tokens only. Past bars muted, today's bar accent. Weight chart: daily dots plus a 7-day average line.
- Hero numbers are plain mono numerals with a small unit, not rings.

## Navigation

- Phone tab bar (glass): Today · Train · Eat · Plan · Body. Hidden on the live session screen.
- Shared page header: title (the tab label; on Today the date, e.g. "Sat, Nov 21"), streak chip on Today only (flame + days; popover with current and best streak), Coach button, profile button (Settings, Admin for admins, Widgets on Android, Sign out).
- Removed: centre (+) button, "More" drawer, quick-actions sheet, quick-log modal.
- Desktop (768px+): 224px left rail — Today, Train, Eat, Planner, Habits, Body · divider · Coach · Settings and account pinned at the bottom. From 1024px, two columns at max-width 1120px: Today (hero + ledger | next up, habits, meals), Eat (ledger + week chart | meals), Body (hero + chart | history). Live session centred at max-width 680px. Sheets become centred 480px glass dialogs.
- Minimised workout: a glass bar above the tab bar on every other screen ("Upper body A · 24:10 · 5 / 18 sets", rest countdown badge, expand).

## Live session

- Top bar (52px): minimise chevron (44px) · name, elapsed time (mono), sync state (Saved / Saving / Offline / Not saved) · menu with Workout note, Reorder exercises, Discard workout (confirm).
- Progress hairline under the top bar: sets done / total, one tick per exercise boundary.
- Ledger, full-bleed (12px side padding, 366px usable at 390px, 8px gaps, 52px rows, 44px inputs and ticks). Header row: Set | Prev | values | Done.

| Tracking type | Columns (px) |
|---|---|
| Weight × reps | Set 36 · Prev 66 · Weight 94 · Reps 86 · Done 52 |
| Bodyweight reps | Set 36 · Prev 114 · Reps 140 · Done 52 (with added weight: the weight × reps grid) |
| Duration | Set 36 · Prev 104 · Time 150 · Done 52 |
| Cardio | Set 36 · Prev 66 · Min 94 · km 86 · Done 52 |

- PR and RPE never take a column: an 18px line under the set's values ("New PR · RPE 8.5").
- Empty fields show last session's value as a ghost; logging with empty fields saves the ghost values. A repeated set is one tap and never opens the keyboard.
- The exercise that owns the next open set is expanded; others are collapsed rows ("0 / 3 sets · Last 30 kg × 10"; finished: "3 / 3 sets" with an ink check). "Add exercise" is a dashed row at the end of the list.
- Dock (glass, replaces the tab bar): a 48px strip for the rest timer (−15s, time, +15s, Skip, 3px accent track) or the 7-second Undo strip, which keeps a compact rest countdown on its right; then a 60px action row with Finish (secondary, left) and "Log set N · W × R" (primary). When every set is ticked the primary becomes "Finish workout".
- Set badge (W / number / D / F) opens a popover: set type, RPE, Delete. No bottom drawer. Swipe-left to delete is optional polish.
- Editing a value: system keypad (`inputMode` decimal or numeric), select-all on focus, and a 44px accessory bar above the keyboard with steppers (±2.5 weight, ±1 reps) and Next (weight → reps → log; Enter does the same).
- Reorder: the menu item collapses exercises to 48px rows with drag handles and up / down buttons.
- Toasts sit 8px above the dock, never at the top.
- Finish: one sheet (duration, sets done, volume, "N unticked sets will not be saved", Complete workout, Keep going) → summary (stats, PRs, a Suggested diff to update routine targets with today's numbers).
- Must keep working: ghost prefill and one-tap log, autosave with offline draft, wake lock, wall-clock rest timer, undo after deletes, PR detection.
- Later phase — supersets: "Link superset with next / Unlink" in the exercise menu; linked exercises expand together with a continuous 2px accent rail and an "SS" chip; the active row alternates through the round and the rest timer starts after the round.

## Screens

Today — header · adaptive workout hero (week strip, routine, primary button) · fuel ledger (kcal left with "eaten of target" caption; protein with track, carbs, fat; steps; water with "+250 ml") · next up and habits (1–2 next events and today's habits, checkable inline) · meals today (latest 3 and a "Log meal" row). Hero states: planned → Start workout; in progress → accent status and Resume; done → calm summary with "View summary"; rest day → "Rest day" with a quiet "Start empty workout"; nothing planned → "Plan your week". Water: tapping "+250 ml" adds at once with Undo; tapping the value opens a custom amount sheet. Steps: tap to enter manually on the web; live pedometer on Android.

Train — segmented Workouts | History | Exercises.
- Workouts: today's workout bar (or Start empty workout) · week plan strip (tap a day to assign a routine or rest) · My routines (name, exercise count, last done, Start; row opens the editor) · New routine. Empty: "Build your first routine" with Create routine and Start empty workout.
- History: weekly insights (sets per muscle group, volume, PRs) above the session list; detail has Do again, Edit, Save as routine, Delete (confirm).
- Exercises: search, muscle and equipment filter chips, list with a Custom badge, New custom exercise; custom exercises can be edited and deleted; detail shows records, a progress chart and past sets.
- Routine editor: the same ledger table and set popover as the live session, in target mode.

Eat — segmented Day | Week.
- Day: date navigator · ledger without steps (kcal left, macros, water) · Log meal (primary) and Scan meal (secondary) · one chronological meal list (time, name, type tag, kcal and protein, menu: Edit, Log again, Delete with Undo). Over target: amber "120 kcal over", caption stays neutral.
- Add-meal sheet: Manual (name, calories, protein; "More details" holds carbs, fat, meal type, ingredients) or Scan (photo → skeleton inside a Suggested container → editable estimate → Accept / Dismiss).
- Week: 7-day averages · energy-balance chart · daily rows that jump to that day.
- Later phase: three quick-repeat chips for the meals most often logged at this time of day.

Plan — segmented Schedule | Habits (existing `/planner` and `/habits` routes; the Plan tab is active on both).
- Schedule: week strip · day header with a quiet "Plan my day" · timeline rows (3px category bar, time, repeat / reminder icon; tap to edit in a sheet; delete with Undo) · AI suggestions accepted one by one. Empty: "Clear day".
- Habits: checklist rows (3px colour bar, emoji, title, 7-day strip, tick) · consistency chart below · Archived link. Archive is reversible: Undo, not a danger button.

Body — weight hero (latest weight, 30-day delta, 30d | 90d toggle, chart) · Log weight (primary, one field) and Check in (secondary: weight, body fat, measurements, progress photos, notes, AI body-fat estimate as Suggested) · history rows. First use: "Log your starting weight". Deleting a check-in that has photos stays a confirm.

Coach — full-height chat opened from any header: Close | Coach | New chat · message stream with Suggested proposal cards · suggestion chips above the composer, ordered by the screen it was opened from (slash commands keep working) · 16px input and Send.

Settings — three groups of rows, each opening its own sheet with inline validation and Save: Body and targets (Profile, Calorie and macro targets, Goals) · Preferences (Appearance: System / Light / Dark; Units and rest timer; AI and Coach) · Account and data (Account, Export and data, Sign out). Quiet footer with app version, Android update and widgets links.

Landing (`/`, public, indexed) — sticky glass header (wordmark, Features, Android, FAQ, theme switch, Sign in, Get started) · hero ("A personal fitness tracker built like an instrument.") with Today and live-session vignettes built from real components · three gym-floor facts · five feature rows (Train, Eat, Plan, Body, Coach) · web and Android · your data · FAQ · final call to action · footer. Owner's rules: primary "Get started" → `/signup`; "Sign in"; "Get the Android app" → the releases URL in `services/webview-bridge.ts`; say it is free, that AI features run on a shared limited quota, and that adding your own Gemini key in Settings lifts the limit (add under the hero buttons and as an FAQ entry — the mockup predates this). No invented numbers, testimonials, ratings or awards.

## Words

- Start workout, Resume, Log set, Finish workout, Log meal, Scan meal, Log weight, Check in, Plan my day, Suggested, Accept, Dismiss, Applied, Undo.
- Page title equals the tab label (except Today's date). Sentence case. One spelling (US). No exclamation marks, no hype words.
- No long-press gestures: every action is a visible tap.

## Deliberately cut

Centre (+) button and More drawer · quick-log modal · weekly pulse card on Today · standalone streak card · water in three places · four empty meal-type buckets · nine Settings groups · upfront carbs / fat / ingredient inputs when logging a meal · long-press shortcuts · per-metric accent colours, gradients, blur on cards, coloured shadows.

## To verify while building

- Muted ink on `elevated` in dark is about 4.4:1: nudge it to at least 4.5:1.
- Glass text contrast over bright and dark content in both themes.
- Android WebView: `backdrop-filter` performance, status bar colour in the light theme (native change, cannot be compiled on this machine).
