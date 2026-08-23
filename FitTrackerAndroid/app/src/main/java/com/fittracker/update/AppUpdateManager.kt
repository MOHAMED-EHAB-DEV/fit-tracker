package com.fittracker.update

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import com.fittracker.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Handles Over-The-Air (OTA) APK updates directly from GitHub Releases.
 */
class AppUpdateManager(private val context: Context) {

    companion object {
        private const val TAG = "AppUpdateManager"
        const val GITHUB_REPO_OWNER = "MOHAMED-EHAB-DEV"
        const val GITHUB_REPO_NAME = "fit-tracker"
        private const val RELEASES_API_URL =
            "https://api.github.com/repos/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/releases/latest"
    }

    data class ReleaseInfo(
        val tagName: String,
        val releaseNotes: String,
        val apkDownloadUrl: String
    )

    /**
     * Checks if a new release is available on GitHub and prompts user if an update exists.
     */
    fun checkForUpdates(
        activity: Activity,
        silent: Boolean = true,
        onChecked: ((hasUpdate: Boolean, version: String?) -> Unit)? = null
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val release = fetchLatestRelease()
                withContext(Dispatchers.Main) {
                    if (activity.isFinishing || activity.isDestroyed) return@withContext

                    if (release != null && isNewerVersion(release.tagName)) {
                        onChecked?.invoke(true, release.tagName)
                        showUpdateDialog(activity, release)
                    } else {
                        onChecked?.invoke(false, BuildConfig.VERSION_NAME)
                        if (!silent) {
                            Toast.makeText(
                                activity,
                                "FitTracker is up to date (v${BuildConfig.VERSION_NAME})",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to check for updates: ${e.localizedMessage}")
                withContext(Dispatchers.Main) {
                    if (!silent && !activity.isFinishing && !activity.isDestroyed) {
                        Toast.makeText(
                            activity,
                            "Could not check for updates. Please try again later.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    onChecked?.invoke(false, null)
                }
            }
        }
    }

    /**
     * Fetches the latest release metadata from GitHub Releases API.
     */
    private fun fetchLatestRelease(): ReleaseInfo? {
        val url = URL(RELEASES_API_URL)
        val conn = url.openConnection() as HttpURLConnection
        conn.setRequestProperty("User-Agent", "FitTracker-Android-App")
        conn.setRequestProperty("Accept", "application/vnd.github.v3+json")
        conn.connectTimeout = 8000
        conn.readTimeout = 8000

        if (conn.responseCode != 200) {
            Log.w(TAG, "GitHub API returned HTTP ${conn.responseCode}")
            return null
        }

        val jsonStr = conn.inputStream.bufferedReader().use { it.readText() }
        val root = JSONObject(jsonStr)

        val tagName = root.optString("tag_name", "").trim()
        val body = root.optString("body", "Bug fixes and performance enhancements.")
        val assets = root.optJSONArray("assets") ?: return null

        var apkUrl: String? = null
        for (i in 0 until assets.length()) {
            val asset = assets.getJSONObject(i)
            val name = asset.optString("name", "")
            if (name.endsWith(".apk", ignoreCase = true)) {
                apkUrl = asset.optString("browser_download_url")
                break
            }
        }

        return if (!apkUrl.isNullOrBlank()) {
            ReleaseInfo(
                tagName = tagName,
                releaseNotes = body,
                apkDownloadUrl = apkUrl
            )
        } else {
            null
        }
    }

    /**
     * Compare incoming tag/version string with local BuildConfig.VERSION_NAME.
     */
    private fun isNewerVersion(remoteTag: String): Boolean {
        val currentVersion = BuildConfig.VERSION_NAME.removePrefix("v").trim()
        val remoteVersion = remoteTag.removePrefix("v").trim()

        if (remoteVersion.isBlank() || currentVersion == remoteVersion) {
            return false
        }

        return try {
            val currentParts = currentVersion.split(".").map { it.toIntOrNull() ?: 0 }
            val remoteParts = remoteVersion.split(".").map { it.toIntOrNull() ?: 0 }
            val maxLen = maxOf(currentParts.size, remoteParts.size)

            for (i in 0 until maxLen) {
                val c = currentParts.getOrElse(i) { 0 }
                val r = remoteParts.getOrElse(i) { 0 }
                if (r > c) return true
                if (r < c) return false
            }
            false
        } catch (e: Exception) {
            // Fallback string difference check
            remoteTag != "v$currentVersion" && remoteTag != currentVersion
        }
    }

    /**
     * Displays a clean update dialog informing the user of the new version and changelog.
     */
    private fun showUpdateDialog(activity: Activity, release: ReleaseInfo) {
        val cleanNotes = if (release.releaseNotes.length > 250) {
            release.releaseNotes.substring(0, 250) + "..."
        } else {
            release.releaseNotes
        }

        AlertDialog.Builder(activity)
            .setTitle("FitTracker Update Available 🚀")
            .setMessage("Version ${release.tagName} is available.\n\n$cleanNotes\n\nWould you like to download and install the update now?")
            .setPositiveButton("Update Now") { _, _ ->
                checkInstallPermissionAndDownload(activity, release.apkDownloadUrl)
            }
            .setNegativeButton("Later", null)
            .setCancelable(true)
            .show()
    }

    /**
     * Ensures permission to install unknown apps before initiating download.
     */
    private fun checkInstallPermissionAndDownload(activity: Activity, apkUrl: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!activity.packageManager.canRequestPackageInstalls()) {
                Toast.makeText(
                    activity,
                    "Please allow FitTracker to install updates.",
                    Toast.LENGTH_LONG
                ).show()
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                activity.startActivity(intent)
                // Also trigger download so it's ready when permission is granted
            }
        }

        downloadAndInstallApk(activity, apkUrl)
    }

    /**
     * Downloads APK using Android's system DownloadManager and triggers package installer on finish.
     */
    fun downloadAndInstallApk(activity: Activity, apkUrl: String) {
        Toast.makeText(activity, "Downloading update in background...", Toast.LENGTH_SHORT).show()

        val fileName = "FitTracker-update.apk"
        val storageDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: activity.cacheDir
        val apkFile = File(storageDir, fileName)

        if (apkFile.exists()) {
            apkFile.delete()
        }

        val request = DownloadManager.Request(Uri.parse(apkUrl)).apply {
            setTitle("FitTracker Update")
            setDescription("Downloading latest version...")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationUri(Uri.fromFile(apkFile))
            setMimeType("application/vnd.android.package-archive")
        }

        val downloadManager = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = downloadManager.enqueue(request)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctxt: Context?, intent: Intent?) {
                val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (id == downloadId) {
                    try {
                        activity.unregisterReceiver(this)
                    } catch (_: Exception) {}

                    installApk(activity, apkFile)
                }
            }
        }

        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            activity.registerReceiver(receiver, filter)
        }
    }

    /**
     * Launches Android Package Installer using FileProvider.
     */
    fun installApk(context: Context, file: File) {
        if (!file.exists() || file.length() == 0L) {
            Log.e(TAG, "APK file does not exist or is empty: ${file.absolutePath}")
            return
        }

        try {
            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start APK installer: ${e.localizedMessage}", e)
        }
    }
}
