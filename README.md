# FitTracker

A personal fitness tracker: workouts (routines, live logging, history, personal
records), nutrition (meals, macros, AI photo estimates), habits, a day planner,
an AI coach, body composition check-ins, and an admin panel. It runs as a web
app (installable as a PWA) and inside an Android WebView wrapper
(`FitTrackerAndroid/`) that adds a step counter, home-screen widgets and planner
reminders.

## Stack

- **Next.js 16** (App Router, Turbopack). This version differs from older ones:
  `proxy.ts` replaces middleware, `params`/`searchParams` are Promises, error
  boundaries receive `retry`. The bundled docs are in `node_modules/next/dist/docs/`.
- **React 19**, **Tailwind CSS 4**, lucide icons, visx charts
- **MongoDB** with **Mongoose 9**; **zod 4** for every input
- **jose** (JWT session cookie), **bcryptjs** (passwords)
- **Google Gemini** (`@google/genai`) for AI features
- **Cloudinary** (photos), **Supabase Storage** (optional exercise-image cache),
  **Resend** (optional password-reset email)
- **Bun 1.4** as package manager; **Vitest 5** + `mongodb-memory-server-core`
  for tests (dev dependencies only)
- Android: Kotlin, minSdk 24, targetSdk 34

## Local setup

Requirements: Bun 1.4+, Node.js 20.9+ (22 recommended).

```bash
bun install
bun run dev:local
```

`dev:local` (`scripts/dev-local.mjs`) is the safe way to run the app on your
machine: it starts a throwaway **in-memory MongoDB**, seeds a small exercise
library and one demo admin account (email and password are constants at the
top of the script), replaces every secret with a local placeholder (AI calls
and photo uploads fail on purpose, with a clear message), and serves
http://localhost:3100. It writes its build output to `.next-local`, so it can
run next to a normal `next dev`.

```bash
bun run start:local                              # production build + next start, same safe setup
node scripts/dev-local.mjs --prod --no-build     # next start on the last local production build
node scripts/dev-local.mjs --port=3101           # another port
```

To run against your own services instead, copy `.env.example` to `.env`, fill
it in, and run `bun run dev` (http://localhost:3000). **Never point a
development server at the production database.**

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | `next dev` with your `.env` |
| `bun run dev:local` | Development server with an in-memory database and placeholder keys |
| `bun run start:local` | Production build + `next start`, same safe setup |
| `bun run build` | Production build |
| `bun run start` | Serve a production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript (`tsc --noEmit`) |
| `bun run lint:tokens` | Design-token check: no raw palette classes or hex colours in `app/` and `components/` (`--strict` in CI) |
| `bun run test` / `test:watch` | Vitest (unit and integration tests on an in-memory MongoDB) |
| `bun run bump[:patch\|:minor\|:major]` | Bump `version.json` (Android `versionName`/`versionCode`) |

The same checks run in CI (`.github/workflows/ci.yml`) on every push and pull
request: install with the frozen lockfile, `next typegen` + type-check, lint,
the design-token check, and a build with dummy environment values. The tests
run locally only (`tests/` is not in the repository).

## Environment variables

All names are listed, with comments, in `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs the session cookie (32+ random characters; changing it signs everyone out) |
| `APP_URL` | yes in production (unless on Vercel) | Public base URL for links in emails; never taken from request headers in production |
| `DATA_ENCRYPTION_KEY` | no | Encrypts users' saved Gemini keys; falls back to `JWT_SECRET` |
| `GEMINI_API_KEY` | no | Shared Gemini key; without it AI works only for users with their own key |
| `AI_POWER_MODE` | no | `full` (default), `balanced` or `low` output size |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | for photos | Meal photos, private progress photos, admin exercise images |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | no | Second-level cache for the public exercise-image proxy |
| `IMAGE_PROXY_ALLOWED_HOSTS` | no | Extra exact host names the image proxy may fetch |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Password-reset email. Without them no email is sent; an admin can create a one-time reset link instead |

## Folder overview

```
app/
  (app)/          signed-in screens: Today, Train (workouts/**), Eat (nutrition), planner,
                  habits, body-comp, coach, settings, widgets
  (auth)/         login, signup, forgot-password, reset-password
  (admin)/admin/  admin panel (dashboard, users, exercises, nutrition plans)
  api/            route handlers (all through lib/api/route.ts)
  fit-tracker/images/[...src]/   public, cached proxy for exercise images
components/       UI by area (workout/, nutrition/, dashboard/, admin/, ui/ shared parts, ...)
lib/
  api/            route() / publicRoute() wrapper, errors
  auth/           session (verified against the database), cookies, JWT, admin checks
  workouts/       routines, sessions, records, exercises, migration, calculations
  nutrition/      meals, photo upload/analysis, AI proposal tokens
  planner/, planner-reminders/, assistant/, habits/, body-comp/, dashboard/, admin/
  fitness/        units (kg canonical), daily-log recompute, steps
  time.ts         time-zone helpers ("today" and week boundaries in the user's zone)
  security/       rate limits, secrets encryption, file validation
  db/models/      Mongoose models
services/webview-bridge.ts   web side of the Android bridge
proxy.ts          request pre-filter (sign-in redirects, Origin check)
instrumentation.ts  server error logging (onRequestError)
FitTrackerAndroid/  Android wrapper app
scripts/          dev-local.mjs, bump-version.mjs
tests/            Vitest suites
```

## Design

The interface follows one system, "Calibrated Matte, glass chrome": matte
content on a warm neutral canvas, glass only on the chrome (tab bar, page
header, sheets, popovers, toasts), mono numerals, one cobalt accent. The full
spec and the reference mockups are in `docs/design/` (`README.md`, `PLAN.md`,
`mockup-*.html`).

- **Tokens** live in `app/globals.css`: colours (`canvas`, `surface`,
  `elevated`, `recessed`, `line`, `line-strong`, `ink`, `ink-2`, `ink-3`,
  `ink-inverse`, `accent`, `accent-soft`, `ok`, `warn`, `danger`, `scrim`),
  radii (`rounded-card` 14px, `rounded-control` 10px, `rounded-chip` 6px), type
  roles (`text-display`, `text-title`, `text-section`), the glass utilities
  (`glass-chrome`, `glass-chrome-top`, `glass-sheet`, `glass-float`) and the
  layout variables (`--nav-height`, `--rail-width`, `--dock-height`). Screens use
  these names only; `bun run lint:tokens` fails on raw palette classes or hex
  colours.
- **Themes**: light by default, dark from the system, or chosen in Settings →
  Appearance (System / Light / Dark, kept on the device). `THEME_INIT_SCRIPT`
  (`lib/ui/theme.ts`) sets `html[data-theme]` before the first paint.
- **Fonts**: IBM Plex Sans and IBM Plex Mono (numbers, times, weights).
- **Shared parts** in `components/ui/`: Button, IconButton, Input, Textarea,
  NumberField, Select, SegmentedControl / SegmentedNav, Chip / FilterChip,
  Checkbox, Tick, Sheet (bottom sheet on phones, centred dialog from 768px),
  ConfirmDialog, Popover, Calendar, DateStepper, Surface, Stat, ProgressTrack,
  SuggestedCard, Toast, EmptyState, Skeleton. `/ui-kit` shows them all (in
  development only).
- **Rules**: one primary button per view; reversible deletes happen at once with
  Undo in a toast, irreversible ones ask first (ConfirmDialog); anything the AI
  prepares waits in a Suggested card until accepted; sheets for tasks, popovers
  for small choices; a user-chosen colour appears only as a 3px bar; sentence
  case everywhere.
- **Brand**: `components/shared/BrandMark.tsx` (mark and wordmark, fixed
  `--brand-*` colours). The icons in `public/icons/` and `app/favicon.ico` are
  drawn from the same geometry; the Android launcher icon, notification icon
  and colours (`FitTrackerAndroid/app/src/main/res/`, light and `values-night`)
  match it.

## Workout data model

- **ExerciseCatalog**: the exercise library, plus users' custom exercises
  (`isCustom`, `createdBy`). Archived exercises disappear from the picker but
  stay in routines and history.
- **Routine**: a plan ("Push day"): exercises with target sets (type, rep
  range, weight, rest). Editing a routine never changes past workouts.
  `lastPerformedAt` / `timesPerformed` are rebuilt from finished workouts.
- **WorkoutSession**: one document per performed workout, never reused.
  `in_progress` (at most one per user) or `completed`. Past workouts can be
  logged with a date and duration, edited, or deleted.
- **PersonalRecord**: best weight, estimated 1-rep max, set volume, reps and
  duration per exercise, always rebuilt from history (so deleting or editing a
  workout corrects them).
- **DailyLog**: per user and calendar day (in the user's time zone): food,
  water, steps, habits, calories burned. Day totals are recomputed from the
  source documents (`recomputeDay`), never incremented.
- Weights are stored in kilograms and converted only for input and display.
- The weekly plan lives on the user (`weeklyRoutine`: day -> routine / rest / not planned).

## Security notes

- Sessions: a JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (in production)
  cookie, verified against the database on every request (`lib/auth/session.ts`):
  banned users and old tokens (`tokenVersion`, bumped by "sign out everywhere
  else", password reset, ban or demotion) are refused. `proxy.ts` is only a
  pre-filter; it also rejects cross-site writes by checking `Origin`.
- Every API route goes through `route()` / `publicRoute()`: session check,
  zod validation (keys starting with `$` are rejected), MongoDB-backed rate
  limits, and errors mapped to safe messages (no stack traces or provider
  internals reach the browser). Server errors are logged as JSON lines by
  `instrumentation.ts`, without headers or query strings.
- Passwords: bcrypt. Reset tokens are random, stored hashed, single use and
  valid 30 minutes; forgot-password answers the same way whether or not the
  account exists.
- Admin: every admin route requires the admin role from the database. Admins
  cannot demote, ban or delete themselves, and the last admin who can sign in
  cannot be removed. Deleting a user removes all of their data and photos.
- Photos: progress photos are private Cloudinary assets, delivered only through
  15-minute signed URLs. Meal and progress photos never pass through the public
  image proxy; the proxy serves only allow-listed public images, follows no
  redirects, checks size and file type, and is rate limited.
- Users' own Gemini keys are encrypted at rest (AES-256-GCM) and never sent
  back to the browser. AI output is validated before anything is saved, and the
  coach's Markdown is rendered as text (no HTML).
- Headers (`next.config.ts`): CSP `frame-ancestors 'none'; frame-src 'self';
  object-src 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS,
  `Referrer-Policy`, `Permissions-Policy`.

## Android wrapper

`FitTrackerAndroid/` is a WebView app around the web app. It adds a step
counter (synced to `/api/steps/sync`), home-screen widgets, planner reminders
(from `/api/planner/upcoming`), photo capture, file saving and in-app updates
(the downloaded APK is verified against the installed app's signing key before
installing). The JavaScript bridge only answers pages from the app's own
origin. The Back button first asks the page to close an open dialog
(`window.__ftHandleBack`) before going back.

Releases are built and published by `.github/workflows/build-apk.yml` when
`version.json` is bumped. Signing needs the owner's private release key and
repository secrets: see `FitTrackerAndroid/RELEASE_SIGNING.md`.

## Owner details (to be filled in by the owner)

- Owner / maintainer: **Mohammed Ehab**
- Support contact: [mohammedehab.vercel.app/contact](https://mohammedehab.vercel.app/contact)
- Licence: **All rights reserved.** See [`LICENSE`](LICENSE). No permission is granted to use, copy, modify or distribute this code.

## Deployment

The app is deployed on Vercel (`vercel.json` pins Bun 1.4).

1. Create a MongoDB Atlas cluster (a replica set, so user deletion runs in a transaction).
2. Set the environment variables above in the Vercel project. Set `APP_URL`
   (or keep Vercel's automatic system variables enabled).
3. In Cloudinary, enable **Settings -> Security -> Strict transformations**.
4. Optional: Resend (`RESEND_API_KEY`, `EMAIL_FROM`) for reset emails; Supabase for the image cache.
5. Deploy. CI must be green first.

### First deploy of this version

- Old workouts are converted **per user, on that user's first visit** after the
  deploy (`ensureWorkoutsMigrated` in `lib/workouts/migrate.ts`): routines and
  workout history are created from the old `workouts` collection, records are
  rebuilt. The conversion is non-destructive: the old documents are kept.
- Workouts that the old app overwrote when a routine was logged again cannot be
  recovered; only what was still stored is converted.
