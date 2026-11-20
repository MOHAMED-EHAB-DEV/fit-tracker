# FitTracker Release Notes

## Unreleased — full rebuild (not yet released)

> Not deployed and not published as an APK yet. Before an Android release,
> bump `version.json` (`bun run bump:minor`); the release workflow refuses to
> publish over an existing version tag.

This release rebuilds the app's foundations and the workout system, and
reviews every other module for security and correctness.

### Workouts (rebuilt)
- **Routines** (plans) and **workouts** (what was performed) are now separate.
  Every performed workout is its own history entry; repeating a routine never
  overwrites an earlier workout. Editing a routine never changes history.
- Live workout screen: one-tap set logging, "last time" numbers, set types
  (warm-up, working, drop, to failure), RPE, rest timer, per-exercise unit,
  rest time and notes, reorder / replace / remove with undo, empty workouts
  with a multi-select exercise picker, custom exercises.
- An open workout is saved on the device as you go and synced to the server,
  including after a reload or a lost connection, and is shown on every screen
  ("Workout in progress") until it is finished or discarded. Only one workout
  can be open at a time.
- Log a past workout with its date and duration; edit or delete finished
  workouts. Personal records, the day's calories and the routine's "last done"
  are rebuilt from history after every change.
- Week plan (routine, rest day or not planned per weekday), routine templates,
  "Save as routine", "Update routine targets" from a finished workout,
  exercise library with history and records per exercise.
- Old workouts are converted per user on their first visit after the deploy;
  the old records are kept. Workouts the old app overwrote cannot be recovered.

### Everywhere
- "Today" and week boundaries follow each user's own time zone; weights are
  stored in kilograms and converted for display.
- New navigation (phone: Today, Train, quick add, Eat, More), Today page,
  Quick log (food, water, weight, steps), sign-up with a five-step onboarding,
  forgot / reset password, settings with custom targets, time zone, week
  start, units and data export (JSON).
- Dialogs close with Escape and the Android Back button (one at a time).

### Security and reliability
- Sessions are verified against the database on every request; banning,
  demoting, a password reset or "Sign out everywhere else" ends sessions at once.
  The session cookie is now `SameSite=Lax`.
- Every API route validates its input, is rate limited and returns safe error
  messages. Server errors are logged without cookies or tokens.
- Password reset tokens are hashed, single use and valid for 30 minutes.
  Reset emails need `RESEND_API_KEY` and `EMAIL_FROM`; without them an admin can
  create a one-time reset link.
- Admin panel: self and last-admin protections, full data and photo removal
  when a user is deleted.
- Progress photos are private and shown only through short-lived signed links.
  Meal and progress photos no longer pass through the public image cache.
- Users' Gemini keys are stored encrypted. AI answers are validated before
  anything is saved; AI and photo failures show a clear message.
- Android: the JavaScript bridge answers only the app's own pages; releases are
  signed with a private release key (see `FitTrackerAndroid/RELEASE_SIGNING.md`);
  in-app updates are verified against the installed app's signature.

### Not included
- There is no offline mode. Without a connection the app shows an offline
  page; only a workout that is already open keeps working and syncs later.

---

## v2.0.0 — AI Day Planner and habits (2026-09-15)

> Version code 11. Corrected in the rebuild above where noted.

- **AI day planner** (`/planner`): Gemini suggests a schedule for a day; you
  review it and either add it to the day or replace the day's one-time events.
- **Planner timeline**: a planner day runs from 05:00 to 04:59 the next
  morning, so late-night blocks are listed after 23:59. A "Now" marker shows the
  current time on today's plan.
- **Repeating events**: once, daily, weekly or monthly, with per-day completion.
  Delete only one day, that day and the following ones, or the whole series.
- **Habits linked to events**: completing an event ticks its linked habits for
  that day.
- **Categories**: workout, nutrition, habit, recovery, deep focus, general.
- **Android reminders**: the Android app schedules notifications for upcoming
  planner events.
- **Today**: a plan widget with progress and quick completion.

## v1.2.2 — Android 13–15 compatibility
- Dark status and navigation bars with light icons; the WebView no longer draws
  under the status bar.
- Back handling through `OnBackPressedDispatcher` with predictive back enabled.
- Android 14 "selected photos" permission; camera intents grant URI access
  explicitly; widget broadcasts target the app's own package.
