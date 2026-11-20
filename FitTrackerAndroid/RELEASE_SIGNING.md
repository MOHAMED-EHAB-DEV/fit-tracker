# Release signing (owner steps)

Until v2.0.0 every published APK was a **debug** build signed with
`keystore/debug.keystore`, whose password is public. Anyone can sign an APK
with that key, and Android would install it as an "update" of FitTracker.
The code now builds and publishes the **release** variant signed with a
private key. These steps can only be done by the repository owner.

## Shortcut on Windows (does steps 1 to 3)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-android-signing.ps1
```

It asks for a password, creates the key and the rotation lineage in
`%USERPROFILE%\fittracker-signing` (outside the repository) and saves the five
GitHub secrets with the GitHub CLI. It never overwrites an existing key.
The manual steps below do the same by hand.

## 1. Create the private release key (on your own machine, once)

```bash
keytool -genkeypair -v \
  -keystore fittracker-release.jks -storetype PKCS12 \
  -alias fittracker -keyalg RSA -keysize 4096 -validity 10000
```

Keep `fittracker-release.jks` and its passwords in a password manager and an
offline backup. Never commit it (`.gitignore` blocks `*.jks`/`*.keystore`).
Losing it means no installed copy can ever be updated again.

## 2. Add the GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 fittracker-release.jks` (macOS: `base64 -i fittracker-release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `fittracker` |
| `ANDROID_KEY_PASSWORD` | key password |
| `ANDROID_SIGNING_LINEAGE_BASE64` | optional, see step 3 |

Without the first four the workflow fails and publishes nothing.

## 3. Let existing installs accept the new key (key rotation)

Phones that installed an APK from GitHub have the debug-signed app. Android
refuses an update signed with a different key unless the APK carries a
proof-of-rotation (APK Signature Scheme v3, Android 9+). Create the lineage
once, locally:

```bash
apksigner rotate --out signing.lineage \
  --old-signer --ks keystore/debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android \
  --new-signer --ks fittracker-release.jks --ks-key-alias fittracker
```

Do not pass `--set-rollback true`: after rotation, devices then refuse
updates signed only with the old (public) key.

Store it as `ANDROID_SIGNING_LINEAGE_BASE64` (`base64 -w0 signing.lineage`).
The workflow then re-signs the release with both signers.

Limits to know:
- Android 7.0–8.1 (API 24–27) do not support v3 rotation. Those phones keep
  trusting the old public key for this app; the only clean fix for them is to
  uninstall and install the new release (data is lost unless exported first).
- Installs that never update keep the old app and its old updater.

## 4. Bump the version and publish

The workflow refuses to republish an existing tag (`v2.0.0` already exists):

```bash
node scripts/bump-version.mjs minor   # writes version.json, package.json, RELEASE_NOTES.md header
```

Commit and push; the workflow builds `assembleRelease`, checks the signature is
not the debug key, writes the APK's SHA-256 into the release's `version.json`
(the in-app updater verifies it) and publishes `v<versionName>`.

## 5. Purge the old leak (optional but recommended)

The debug keystore stays in the repository on purpose: it is needed for the
rotation in step 3 and identifies the old signer. It grants nothing once all
devices have rotated. If you also want it out of history, use
`git filter-repo` after every user has updated, and force-push.

## Local builds

```bash
# Debug (debug key, debuggable, http allowed to 10.0.2.2/localhost only):
./gradlew assembleDebug
./gradlew assembleDebug -PfittrackerDevOrigin=http://10.0.2.2:3000   # point at a local dev server

# Release (needs the private key):
export ANDROID_KEYSTORE_PATH=/path/to/fittracker-release.jks
export ANDROID_KEYSTORE_PASSWORD=...  ANDROID_KEY_ALIAS=fittracker  ANDROID_KEY_PASSWORD=...
./gradlew assembleRelease
```

## Device tests still to do (not possible without a phone)

- Install the rotated release over a debug-signed 2.0.0 on Android 9+; confirm data is kept.
- chrome://inspect must NOT list the release build's WebView.
- Steps: walk with the app closed, tap a widget's Sync, check the count and the brief notification.
- Reboot mid-day, open the app: steps since boot are added once (no huge jump).
- Planner: create an event 20 min ahead, close the app, wait for the reminder; edit/delete cancels it; reboot keeps it.
- Deny then re-allow activity recognition, camera and notifications from the in-app prompts and settings links.
- Settings → Export data saves a file through the "Save as" dialog.
- Airplane mode at launch shows the offline page; Retry recovers.
