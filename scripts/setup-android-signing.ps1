<#
  Creates the private Android release key for FitTracker and stores it as
  GitHub Actions secrets. Run it yourself, once, in PowerShell:

      powershell -ExecutionPolicy Bypass -File scripts\setup-android-signing.ps1

  What it does:
    1. Asks you for a password (typed hidden, never written to disk).
    2. Creates  <OutputDir>\fittracker-release.jks  (outside the repository).
    3. Creates  <OutputDir>\signing.lineage  so phones that have the old
       debug-signed app accept the update (Android 9+).
    4. Sets the five GitHub secrets the release workflow reads.

  Options:
    -OutputDir <folder>   where the key is written (default: %USERPROFILE%\fittracker-signing)
    -SkipGitHub           create the files only; do not touch GitHub
    -Repo <owner/name>    GitHub repository (default: the one this folder points at)

  Afterwards: back up the key file and the password (password manager plus an
  offline copy). If you lose either, no installed copy of the app can ever be
  updated again.
#>
param(
  [string]$OutputDir = (Join-Path $env:USERPROFILE "fittracker-signing"),
  [switch]$SkipGitHub,
  [string]$Repo = ""
)

$ErrorActionPreference = "Stop"
$KeyAlias = "fittracker"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DebugKeystore = Join-Path $RepoRoot "FitTrackerAndroid\keystore\debug.keystore"
$Keystore = Join-Path $OutputDir "fittracker-release.jks"
$Lineage = Join-Path $OutputDir "signing.lineage"

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host "STOPPED: $Message" -ForegroundColor Red
  exit 1
}

function Find-Keytool {
  $command = Get-Command keytool -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidates = @()
  if ($env:JAVA_HOME) { $candidates += (Join-Path $env:JAVA_HOME "bin\keytool.exe") }
  $candidates += "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
  if (Test-Path "C:\Program Files\Java") {
    Get-ChildItem "C:\Program Files\Java" -Directory | ForEach-Object {
      $candidates += (Join-Path $_.FullName "bin\keytool.exe")
    }
  }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Find-Apksigner {
  $roots = @()
  if ($env:ANDROID_HOME) { $roots += $env:ANDROID_HOME }
  if ($env:ANDROID_SDK_ROOT) { $roots += $env:ANDROID_SDK_ROOT }
  $roots += (Join-Path $env:LOCALAPPDATA "Android\Sdk")
  foreach ($root in $roots) {
    $buildTools = Join-Path $root "build-tools"
    if (-not (Test-Path $buildTools)) { continue }
    $found = Get-ChildItem $buildTools -Directory | Sort-Object Name -Descending | ForEach-Object {
      Join-Path $_.FullName "apksigner.bat"
    } | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($found) { return $found }
  }
  return $null
}

function Read-Password {
  while ($true) {
    $first = Read-Host "Choose a password for the key (12+ characters: letters, digits, - _ .)" -AsSecureString
    $second = Read-Host "Type it again" -AsSecureString
    $a = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($first))
    $b = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($second))
    if ($a -cne $b) { Write-Host "The two entries differ. Try again." -ForegroundColor Yellow; continue }
    if ($a -notmatch '^[A-Za-z0-9_.\-]{12,}$') {
      Write-Host "Use at least 12 characters, only letters, digits, - _ and ." -ForegroundColor Yellow
      continue
    }
    return $a
  }
}

# ---- checks -----------------------------------------------------------------
$keytool = Find-Keytool
if (-not $keytool) { Stop-WithMessage "keytool was not found. Install a JDK or Android Studio first." }
if (Test-Path $Keystore) {
  Stop-WithMessage "$Keystore already exists. This script never overwrites a key. Move it away first if you really want a new one."
}
if (-not $SkipGitHub) {
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-WithMessage "GitHub CLI (gh) was not found. Install it, or run with -SkipGitHub." }
  if (-not $Repo) {
    Push-Location $RepoRoot
    try { $Repo = (& gh repo view --json nameWithOwner --jq .nameWithOwner) } finally { Pop-Location }
  }
  if (-not $Repo) { Stop-WithMessage "Could not work out the GitHub repository. Pass -Repo owner/name." }
  Write-Host "GitHub repository: $Repo"
}

New-Item -ItemType Directory -Force $OutputDir | Out-Null
$password = Read-Password
# The tools read the password from this variable, so it never appears on a command line.
$env:FT_SIGNING_PASSWORD = $password

try {
  # ---- 1. the private key ---------------------------------------------------
  Write-Host ""
  Write-Host "Creating the release key (4096-bit RSA, valid about 27 years)..."
  & $keytool -genkeypair -keystore $Keystore -storetype PKCS12 -alias $KeyAlias `
    -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=FitTracker" `
    -storepass:env FT_SIGNING_PASSWORD -keypass:env FT_SIGNING_PASSWORD
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Keystore)) { Stop-WithMessage "keytool could not create the key." }

  # ---- 2. the proof that the new key replaces the old debug key --------------
  $apksigner = Find-Apksigner
  $haveLineage = $false
  if (-not $apksigner) {
    Write-Host "apksigner was not found (Android SDK build-tools), so no lineage was created." -ForegroundColor Yellow
    Write-Host "Phones with the old app will have to uninstall it before installing the new one." -ForegroundColor Yellow
  } elseif (-not (Test-Path $DebugKeystore)) {
    Write-Host "The old debug keystore was not found, so no lineage was created." -ForegroundColor Yellow
  } else {
    if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $keytool) }
    Write-Host "Creating the key-rotation proof..."
    & $apksigner rotate --out $Lineage `
      --old-signer --ks $DebugKeystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android `
      --new-signer --ks $Keystore --ks-key-alias $KeyAlias --ks-pass env:FT_SIGNING_PASSWORD --key-pass env:FT_SIGNING_PASSWORD
    if ($LASTEXITCODE -eq 0 -and (Test-Path $Lineage)) { $haveLineage = $true }
    else { Write-Host "apksigner could not create the lineage; continuing without it." -ForegroundColor Yellow }
  }

  # ---- 3. GitHub secrets ----------------------------------------------------
  if (-not $SkipGitHub) {
    Write-Host ""
    Write-Host "Saving the secrets to $Repo ..."
    $keystoreBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Keystore))
    & gh secret set ANDROID_KEYSTORE_BASE64 --repo $Repo --body $keystoreBase64
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage "gh could not save ANDROID_KEYSTORE_BASE64. The key file itself is fine: $Keystore" }
    & gh secret set ANDROID_KEYSTORE_PASSWORD --repo $Repo --body $password
    & gh secret set ANDROID_KEY_PASSWORD --repo $Repo --body $password
    & gh secret set ANDROID_KEY_ALIAS --repo $Repo --body $KeyAlias
    if ($haveLineage) {
      $lineageBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Lineage))
      & gh secret set ANDROID_SIGNING_LINEAGE_BASE64 --repo $Repo --body $lineageBase64
    }
    Write-Host ""
    Write-Host "Secrets now in ${Repo}:"
    & gh secret list --repo $Repo
  }
}
finally {
  Remove-Item Env:\FT_SIGNING_PASSWORD -ErrorAction SilentlyContinue
  $password = $null
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Key file:  $Keystore"
if ($haveLineage) { Write-Host "  Lineage:   $Lineage" }
Write-Host ""
Write-Host "Now, before anything else:"
Write-Host "  1. Save the password in your password manager."
Write-Host "  2. Copy the folder $OutputDir to an offline backup (USB drive)."
Write-Host "  Losing the key or the password means the app can never be updated again."
if ($SkipGitHub) {
  Write-Host ""
  Write-Host "GitHub was skipped. Add the secrets by hand: see FitTrackerAndroid\RELEASE_SIGNING.md, step 2."
}
