package com.fittracker.update

import android.app.Activity
import android.app.Dialog
import android.app.ProgressDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import com.fittracker.BuildConfig
import com.fittracker.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * In-app updates from GitHub Releases.
 *
 * - HTTPS only, including every redirect.
 * - "Up to date" is shown only when the check succeeded; failures say so.
 * - The install permission is obtained before anything is downloaded.
 * - The downloaded APK must match the SHA-256 published in the release's
 *   version.json (when present), be this app's package with a higher version,
 *   and be signed by the installed app's key (or a key it rotated to) and, in
 *   release builds, by the pinned release certificate.
 */
class AppUpdateManager(context: Context) {

    private val appContext: Context = context.applicationContext

    companion object {
        private const val TAG = "AppUpdateManager"
        const val GITHUB_REPO_OWNER = "MOHAMED-EHAB-DEV"
        const val GITHUB_REPO_NAME = "fit-tracker"
        private const val RELEASES_API_URL =
            "https://api.github.com/repos/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/releases/latest"
        private const val MAX_JSON_BYTES = 2 * 1024 * 1024
        private const val MAX_APK_BYTES = 200L * 1024 * 1024
        private const val MAX_REDIRECTS = 5

        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        /** Release waiting for the "install unknown apps" permission. */
        @Volatile private var pendingInstall: ReleaseInfo? = null
        private var dialogRef: WeakReference<Dialog>? = null
        private var progressRef: WeakReference<Dialog>? = null
        @Volatile private var sessionDismissed = false
        @Volatile private var checkInFlight = false
        @Volatile private var downloadInFlight = false
    }

    data class ReleaseInfo(
        val versionName: String,
        val versionCode: Int,
        val releaseNotes: String,
        val apkDownloadUrl: String,
        /** Lowercase hex SHA-256 of the APK, from the release's version.json. */
        val apkSha256: String?
    )

    private sealed class CheckResult {
        data class Available(val release: ReleaseInfo) : CheckResult()
        object UpToDate : CheckResult()
        data class Failed(val reason: String) : CheckResult()
    }

    private class UpdateException(message: String) : IOException(message)

    // ---- installed version --------------------------------------------------

    private fun installedPackageInfo(flags: Int = 0): PackageInfo? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.packageManager.getPackageInfo(appContext.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
        } else {
            @Suppress("DEPRECATION")
            appContext.packageManager.getPackageInfo(appContext.packageName, flags)
        }
    } catch (_: Exception) {
        null
    }

    fun getInstalledVersionName(): String =
        (installedPackageInfo()?.versionName ?: BuildConfig.VERSION_NAME).removePrefix("v").trim()

    fun getInstalledVersionCode(): Long {
        val info = installedPackageInfo() ?: return BuildConfig.VERSION_CODE.toLong()
        return versionCodeOf(info)
    }

    private fun versionCodeOf(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }

    // ---- check --------------------------------------------------------------

    fun checkForUpdates(activity: Activity, silent: Boolean = true) {
        if (silent && (sessionDismissed || isDialogShowing())) return
        if (checkInFlight) return
        checkInFlight = true

        scope.launch {
            val result = try {
                fetchLatestRelease()
            } catch (e: Exception) {
                Log.w(TAG, "Update check failed: ${e.message}")
                CheckResult.Failed(e.message ?: "network error")
            }
            withContext(Dispatchers.Main) {
                checkInFlight = false
                if (activity.isFinishing || activity.isDestroyed) return@withContext
                when (result) {
                    is CheckResult.Available -> showCustomUpdateDialog(activity, result.release)
                    is CheckResult.UpToDate -> if (!silent) {
                        toast(activity, "FitTracker is up to date (v${getInstalledVersionName()})")
                    }
                    is CheckResult.Failed -> if (!silent) {
                        toast(activity, "Could not check for updates: ${result.reason}")
                    }
                }
            }
        }
    }

    private fun isDialogShowing(): Boolean = dialogRef?.get()?.isShowing == true

    /** Opens an HTTPS connection, following up to 5 redirects, all of which must stay on HTTPS. */
    private fun openHttps(startUrl: String, accept: String): HttpURLConnection {
        var current = URL(startUrl)
        repeat(MAX_REDIRECTS + 1) {
            if (current.protocol != "https") throw UpdateException("refused a non-HTTPS address")
            val connection = current.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("User-Agent", "FitTracker-Android-App")
            connection.setRequestProperty("Accept", accept)
            val status = connection.responseCode
            if (status in 300..399) {
                val location = connection.getHeaderField("Location")
                connection.disconnect()
                if (location.isNullOrBlank()) throw UpdateException("redirect without a location")
                current = URL(current, location)
                return@repeat
            }
            if (status != HttpURLConnection.HTTP_OK) {
                connection.disconnect()
                throw UpdateException(
                    when (status) {
                        403, 429 -> "GitHub rate limit reached, try again later"
                        404 -> "no published release found"
                        else -> "server returned HTTP $status"
                    }
                )
            }
            return connection
        }
        throw UpdateException("too many redirects")
    }

    private fun httpsGetText(url: String, accept: String): String {
        val connection = openHttps(url, accept)
        try {
            if (connection.contentLengthLong > MAX_JSON_BYTES) throw UpdateException("response too large")
            val bytes = connection.inputStream.use { input ->
                val out = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    total += read
                    if (total > MAX_JSON_BYTES) throw UpdateException("response too large")
                    out.write(buffer, 0, read)
                }
                out.toByteArray()
            }
            return String(bytes, Charsets.UTF_8)
        } finally {
            connection.disconnect()
        }
    }

    private fun fetchLatestRelease(): CheckResult {
        val root = JSONObject(httpsGetText(RELEASES_API_URL, "application/vnd.github+json"))
        val tagName = root.optString("tag_name", "").trim()
        val releaseTitle = root.optString("name", "").trim()
        val body = root.optString("body", "")
        val assets = root.optJSONArray("assets") ?: return CheckResult.Failed("the latest release has no files")

        var apkUrl: String? = null
        var versionJsonUrl: String? = null
        for (i in 0 until assets.length()) {
            val asset = assets.optJSONObject(i) ?: continue
            val name = asset.optString("name", "")
            val url = asset.optString("browser_download_url", "")
            if (!url.startsWith("https://")) continue
            when {
                name.equals("FitTracker.apk", ignoreCase = true) -> apkUrl = url
                name.endsWith(".apk", ignoreCase = true) && apkUrl == null -> apkUrl = url
                name.equals("version.json", ignoreCase = true) -> versionJsonUrl = url
            }
        }
        if (apkUrl.isNullOrBlank()) return CheckResult.Failed("the latest release has no APK")

        var versionName: String? = null
        var versionCode = 0
        var notes = body
        var sha256: String? = null
        if (!versionJsonUrl.isNullOrBlank()) {
            val versionJson = JSONObject(httpsGetText(versionJsonUrl, "application/octet-stream"))
            versionName = versionJson.optString("versionName", "").ifBlank { null }
            versionCode = versionJson.optInt("versionCode", 0)
            versionJson.optString("releaseNotes", "").takeIf { it.isNotBlank() }?.let { notes = it }
            sha256 = versionJson.optString("apkSha256", "").lowercase()
                .takeIf { Regex("^[0-9a-f]{64}$").matches(it) }
        }
        val semver = Regex("""\bv?(\d+\.\d+\.\d+)\b""")
        val resolvedName = versionName
            ?: semver.find(releaseTitle)?.groupValues?.get(1)
            ?: semver.find(tagName)?.groupValues?.get(1)
            ?: return CheckResult.Failed("could not read the release version")

        val release = ReleaseInfo(resolvedName.removePrefix("v").trim(), versionCode, notes, apkUrl, sha256)
        return if (isNewerVersion(release)) CheckResult.Available(release) else CheckResult.UpToDate
    }

    private fun isNewerVersion(release: ReleaseInfo): Boolean {
        val localCode = getInstalledVersionCode()
        if (release.versionCode > 0 && localCode > 0) return release.versionCode > localCode

        val local = getInstalledVersionName().split(".").map { it.toIntOrNull() ?: 0 }
        val remote = release.versionName.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(local.size, remote.size)) {
            val l = local.getOrElse(i) { 0 }
            val r = remote.getOrElse(i) { 0 }
            if (r != l) return r > l
        }
        return false
    }

    // ---- dialog -------------------------------------------------------------

    private fun showCustomUpdateDialog(activity: Activity, release: ReleaseInfo) {
        if (isDialogShowing()) return
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_app_update, null)
        dialog.setContentView(view)
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setLayout((activity.resources.displayMetrics.widthPixels * 0.90).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        view.findViewById<TextView>(R.id.tvVersionBadge).text = "v${release.versionName}"
        val notesView = view.findViewById<TextView>(R.id.tvReleaseNotes)
        try {
            io.noties.markwon.Markwon.create(activity).setMarkdown(notesView, release.releaseNotes)
        } catch (_: Exception) {
            notesView.text = release.releaseNotes
        }

        view.findViewById<Button>(R.id.btnLater).setOnClickListener {
            sessionDismissed = true
            dialog.dismiss()
        }
        view.findViewById<Button>(R.id.btnUpdateNow).setOnClickListener {
            dialog.dismiss()
            startUpdate(activity, release)
        }
        dialog.setCancelable(true)
        dialog.setOnDismissListener { dialogRef = null }
        dialogRef = WeakReference(dialog)
        dialog.show()
    }

    /** Dismisses any dialog owned by `activity`'s window (call from onDestroy). */
    fun dismissDialogs() {
        listOf(dialogRef, progressRef).forEach { ref ->
            try {
                ref?.get()?.dismiss()
            } catch (_: Exception) {
            }
        }
        dialogRef = null
        progressRef = null
    }

    // ---- install permission -------------------------------------------------

    private fun canInstallPackages(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || appContext.packageManager.canRequestPackageInstalls()

    private fun startUpdate(activity: Activity, release: ReleaseInfo) {
        if (canInstallPackages()) {
            download(activity, release)
            return
        }
        // Download only after the user allowed installs; resumed from onResume.
        pendingInstall = release
        toast(activity, "Allow FitTracker to install updates, then come back to the app.")
        try {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            )
        } catch (e: Exception) {
            pendingInstall = null
            toast(activity, "Could not open the install permission screen.")
        }
    }

    /** Call from Activity.onResume: continues an update waiting for the install permission. */
    fun resumePendingInstall(activity: Activity) {
        val release = pendingInstall ?: return
        if (!canInstallPackages()) {
            pendingInstall = null
            toast(activity, "Update cancelled: FitTracker is not allowed to install updates.")
            return
        }
        pendingInstall = null
        download(activity, release)
    }

    // ---- download, verify, install -----------------------------------------

    @Suppress("DEPRECATION")
    private fun download(activity: Activity, release: ReleaseInfo) {
        if (downloadInFlight) return
        downloadInFlight = true
        val progressDialog = ProgressDialog(activity).apply {
            setTitle("Downloading FitTracker v${release.versionName}")
            setMessage("Please wait while the update downloads…")
            setProgressStyle(ProgressDialog.STYLE_HORIZONTAL)
            isIndeterminate = false
            max = 100
            setCancelable(false)
            show()
        }
        progressRef = WeakReference(progressDialog)

        scope.launch {
            val dir = File(appContext.cacheDir, "updates").apply { mkdirs() }
            val apkFile = File(dir, "FitTracker-update.apk")
            val error: String? = try {
                apkFile.delete()
                val connection = openHttps(release.apkDownloadUrl, "application/octet-stream")
                try {
                    val length = connection.contentLengthLong
                    if (length > MAX_APK_BYTES) throw UpdateException("the update is too large")
                    connection.inputStream.use { input ->
                        apkFile.outputStream().use { output ->
                            val buffer = ByteArray(16 * 1024)
                            var total = 0L
                            var lastProgress = -1
                            while (true) {
                                val read = input.read(buffer)
                                if (read == -1) break
                                total += read
                                if (total > MAX_APK_BYTES) throw UpdateException("the update is too large")
                                output.write(buffer, 0, read)
                                if (length > 0) {
                                    val progress = ((total * 100) / length).toInt()
                                    if (progress != lastProgress) {
                                        lastProgress = progress
                                        withContext(Dispatchers.Main) { progressDialog.progress = progress }
                                    }
                                }
                            }
                        }
                    }
                } finally {
                    connection.disconnect()
                }
                verifyApk(apkFile, release)
            } catch (e: Exception) {
                Log.e(TAG, "Update download failed: ${e.message}")
                "download failed (${e.message ?: "network error"})"
            }

            withContext(Dispatchers.Main) {
                downloadInFlight = false
                try {
                    if (progressDialog.isShowing) progressDialog.dismiss()
                } catch (_: Exception) {
                }
                progressRef = null
                if (error != null) {
                    apkFile.delete()
                    toast(activity, "Update not installed: $error")
                } else if (!activity.isFinishing && !activity.isDestroyed) {
                    installApk(activity, apkFile)
                }
            }
        }
    }

    private fun sha256Hex(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(16 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun certDigest(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun archiveInfo(path: String, flags: Int): PackageInfo? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.packageManager.getPackageArchiveInfo(path, PackageManager.PackageInfoFlags.of(flags.toLong()))
        } else {
            @Suppress("DEPRECATION")
            appContext.packageManager.getPackageArchiveInfo(path, flags)
        }

    /** Returns null when the APK may be installed, or a reason it may not. */
    private fun verifyApk(file: File, release: ReleaseInfo): String? {
        if (!file.isFile || file.length() < 100_000L) return "the download is incomplete"

        val expectedSha = release.apkSha256
        if (expectedSha != null && sha256Hex(file) != expectedSha) return "the file's checksum does not match the release"

        // Android 9-11 only fill in an archive's signingInfo when GET_SIGNATURES is
        // also requested; without it every update would be refused as unsigned.
        @Suppress("DEPRECATION")
        val signingFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES or PackageManager.GET_SIGNATURES
        } else {
            0
        }
        val archive = archiveInfo(file.absolutePath, signingFlag) ?: return "the file is not a valid app package"
        if (archive.packageName != appContext.packageName) return "the file is a different app"
        if (versionCodeOf(archive) <= getInstalledVersionCode()) return "the file is not newer than the installed app"

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            // Older Android cannot read an archive's certificates; the installer still
            // enforces the signature match. Require the published checksum.
            return if (expectedSha == null) "this release has no checksum to verify against" else null
        }

        val archiveSigning = archive.signingInfo ?: return "the file is not signed"
        val archiveCerts = if (archiveSigning.hasMultipleSigners()) {
            archiveSigning.apkContentsSigners
        } else {
            archiveSigning.signingCertificateHistory
        } ?: return "the file is not signed"
        val archiveAll = archiveCerts.map { certDigest(it.toByteArray()) }.toSet()
        val archiveCurrent = if (archiveSigning.hasMultipleSigners()) archiveAll else setOfNotNull(
            archiveCerts.lastOrNull()?.let { certDigest(it.toByteArray()) }
        )

        val installedSigning = installedPackageInfo(PackageManager.GET_SIGNING_CERTIFICATES)?.signingInfo
            ?: return "could not read the installed app's signature"
        val installedCerts = if (installedSigning.hasMultipleSigners()) {
            installedSigning.apkContentsSigners
        } else {
            installedSigning.signingCertificateHistory?.takeLast(1)?.toTypedArray()
        } ?: return "could not read the installed app's signature"
        val installedCurrent = installedCerts.map { certDigest(it.toByteArray()) }

        // Same key, or a key the installed key rotated to (proof of rotation in the APK).
        if (installedCurrent.none { it in archiveAll }) return "the file is signed with a different key"

        val pinned = BuildConfig.RELEASE_CERT_SHA256.lowercase()
        if (pinned.isNotEmpty() && pinned !in archiveCurrent) return "the file is not signed with the FitTracker release key"
        return null
    }

    private fun installApk(activity: Activity, file: File) {
        if (!canInstallPackages()) {
            toast(activity, "Allow FitTracker to install updates, then check for updates again.")
            return
        }
        try {
            val apkUri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start the installer: ${e.message}")
            toast(activity, "Could not open the installer.")
        }
    }

    private fun toast(activity: Activity, message: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
    }
}
