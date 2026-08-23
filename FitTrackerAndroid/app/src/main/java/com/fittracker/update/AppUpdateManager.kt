package com.fittracker.update

import android.app.Activity
import android.app.Dialog
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.text.Spanned
import android.text.method.LinkMovementMethod
import android.util.Log
import android.view.LayoutInflater
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.core.text.HtmlCompat
import com.fittracker.BuildConfig
import com.fittracker.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Handles Over-The-Air (OTA) APK updates directly from GitHub Releases with Markdown changelog rendering.
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
        val versionName: String,
        val versionCode: Int,
        val releaseNotes: String,
        val apkDownloadUrl: String
    )

    /**
     * Checks if a new release is available on GitHub and prompts user with styled changelog.
     */
    fun checkForUpdates(
        activity: Activity,
        silent: Boolean = true,
        onChecked: ((hasUpdate: Boolean, version: String?) -> Unit)? = null
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.d(TAG, "Checking for updates at $RELEASES_API_URL... Current local version: v${BuildConfig.VERSION_NAME} (code: ${BuildConfig.VERSION_CODE})")
                val release = fetchLatestRelease()

                withContext(Dispatchers.Main) {
                    if (activity.isFinishing || activity.isDestroyed) return@withContext

                    if (release != null) {
                        val hasUpdate = isNewerVersion(release.versionName, release.versionCode)
                        Log.d(TAG, "Fetched release v${release.versionName} (code: ${release.versionCode}). Update available: $hasUpdate")

                        if (hasUpdate) {
                            onChecked?.invoke(true, release.versionName)
                            showCustomUpdateDialog(activity, release)
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
                    } else {
                        Log.w(TAG, "No release info could be parsed from GitHub.")
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
                Log.e(TAG, "Failed to check for updates: ${e.localizedMessage}", e)
                withContext(Dispatchers.Main) {
                    if (!silent && !activity.isFinishing && !activity.isDestroyed) {
                        Toast.makeText(
                            activity,
                            "Could not check for updates: ${e.localizedMessage}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    onChecked?.invoke(false, null)
                }
            }
        }
    }

    /**
     * Fetches the latest release metadata from GitHub Releases API and resolves version.json.
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
        val releaseTitle = root.optString("name", "").trim()
        val body = root.optString("body", "### What's New\n- Bug fixes and performance improvements.")
        val assets = root.optJSONArray("assets") ?: return null

        var apkUrl: String? = null
        var versionJsonUrl: String? = null

        for (i in 0 until assets.length()) {
            val asset = assets.getJSONObject(i)
            val name = asset.optString("name", "")
            if (name.endsWith(".apk", ignoreCase = true)) {
                // Prefer specific version APK or default FitTracker.apk
                if (apkUrl == null || name.startsWith("FitTracker-v", ignoreCase = true)) {
                    apkUrl = asset.optString("browser_download_url")
                }
            } else if (name.equals("version.json", ignoreCase = true)) {
                versionJsonUrl = asset.optString("browser_download_url")
            }
        }

        if (apkUrl.isNullOrBlank()) {
            Log.w(TAG, "No .apk asset found in release.")
            return null
        }

        // 1. Try to fetch metadata directly from version.json asset if available
        var resolvedVersionName: String? = null
        var resolvedVersionCode = 0
        var resolvedNotes: String = body

        if (!versionJsonUrl.isNullOrBlank()) {
            try {
                val vConn = URL(versionJsonUrl).openConnection() as HttpURLConnection
                vConn.setRequestProperty("User-Agent", "FitTracker-Android-App")
                vConn.connectTimeout = 5000
                vConn.readTimeout = 5000
                if (vConn.responseCode == 200) {
                    val vText = vConn.inputStream.bufferedReader().use { it.readText() }
                    val vJson = JSONObject(vText)
                    resolvedVersionName = vJson.optString("versionName", "")
                    resolvedVersionCode = vJson.optInt("versionCode", 0)
                    val customNotes = vJson.optString("releaseNotes", "")
                    if (customNotes.isNotBlank()) {
                        resolvedNotes = customNotes
                    }
                }
            } catch (e: Exception) {
                Log.d(TAG, "version.json download failed: ${e.localizedMessage}")
            }
        }

        // 2. Fallback: Extract SemVer from release title (e.g. "FitTracker Android App v1.0.2")
        if (resolvedVersionName.isNullOrBlank()) {
            val semverRegex = Regex("""\bv?(\d+\.\d+\.\d+)\b""")
            val matchInTitle = semverRegex.find(releaseTitle)
            val matchInTag = semverRegex.find(tagName)
            resolvedVersionName = matchInTitle?.groupValues?.get(1)
                ?: matchInTag?.groupValues?.get(1)
                ?: tagName.removePrefix("v").trim()
        }

        return ReleaseInfo(
            versionName = resolvedVersionName.removePrefix("v").trim(),
            versionCode = resolvedVersionCode,
            releaseNotes = resolvedNotes,
            apkDownloadUrl = apkUrl
        )
    }

    /**
     * Compares incoming version with local BuildConfig.VERSION_NAME and BuildConfig.VERSION_CODE.
     */
    private fun isNewerVersion(remoteVersion: String, remoteCode: Int): Boolean {
        val currentVersion = BuildConfig.VERSION_NAME.removePrefix("v").trim()
        val cleanRemote = remoteVersion.removePrefix("v").trim()

        Log.d(TAG, "Comparing local: [name=$currentVersion, code=${BuildConfig.VERSION_CODE}] vs remote: [name=$cleanRemote, code=$remoteCode]")

        // 1. If remote versionCode is valid (> 0), integer comparison is 100% accurate
        if (remoteCode > 0 && BuildConfig.VERSION_CODE > 0) {
            if (remoteCode > BuildConfig.VERSION_CODE) return true
            if (remoteCode < BuildConfig.VERSION_CODE) return false
        }

        // 2. SemVer comparison: major.minor.patch
        if (cleanRemote.isBlank() || cleanRemote.equals("latest", ignoreCase = true) || currentVersion == cleanRemote) {
            return false
        }

        return try {
            val currentParts = currentVersion.split(".").map { it.toIntOrNull() ?: 0 }
            val remoteParts = cleanRemote.split(".").map { it.toIntOrNull() ?: 0 }
            val maxLen = maxOf(currentParts.size, remoteParts.size)

            for (i in 0 until maxLen) {
                val c = currentParts.getOrElse(i) { 0 }
                val r = remoteParts.getOrElse(i) { 0 }
                if (r > c) return true
                if (r < c) return false
            }
            false
        } catch (e: Exception) {
            cleanRemote != currentVersion
        }
    }

    /**
     * Converts Markdown text with H1, H2, H3, bold, bullet points into styled Android HTML.
     */
    private fun formatMarkdownToSpanned(markdown: String): Spanned {
        var text = markdown.trim().replace("\r\n", "\n")

        // Escape standard HTML characters
        text = text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")

        val lines = text.split("\n")
        val formattedLines = mutableListOf<String>()

        for (rawLine in lines) {
            val line = rawLine.trimEnd()
            when {
                line.startsWith("### ") -> {
                    val title = line.removePrefix("### ").trim()
                    formattedLines.add("<br/><font color=\"#34D399\"><b>$title</b></font><br/>")
                }
                line.startsWith("## ") -> {
                    val title = line.removePrefix("## ").trim()
                    formattedLines.add("<br/><font color=\"#10B981\"><b><big>$title</big></b></font><br/>")
                }
                line.startsWith("# ") -> {
                    val title = line.removePrefix("# ").trim()
                    formattedLines.add("<br/><font color=\"#10B981\"><b><big><big>$title</big></big></b></font><br/>")
                }
                line.startsWith("- ") || line.startsWith("* ") -> {
                    val item = line.substring(2).trim()
                    formattedLines.add("<font color=\"#34D399\">&#8226;</font>&nbsp;&nbsp;$item<br/>")
                }
                line.isBlank() -> {
                    formattedLines.add("<br/>")
                }
                else -> {
                    formattedLines.add("$line<br/>")
                }
            }
        }

        var html = formattedLines.joinToString("")

        // Bold: **text** or __text__
        html = html.replace(Regex("\\*\\*(.*?)\\*\\*"), "<b>$1</b>")
        html = html.replace(Regex("__(.*?)__"), "<b>$1</b>")

        // Italic: *text* or _text_
        html = html.replace(Regex("(?<!\\*)\\*(?!\\*)(.*?)(?<!\\*)\\*(?!\\*)"), "<i>$1</i>")

        // Code spans: `code`
        html = html.replace(Regex("`([^`]+)`"), "<font color=\"#6EE7B7\"><tt>$1</tt></font>")

        return HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_LEGACY)
    }

    /**
     * Displays a custom modal dialog rendering markdown changelog with Dark + Emerald theme.
     */
    private fun showCustomUpdateDialog(activity: Activity, release: ReleaseInfo) {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_app_update, null)
        dialog.setContentView(view)

        // Make window background transparent so rounded card corners show
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setLayout(
                (activity.resources.displayMetrics.widthPixels * 0.90).toInt(),
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val tvVersionBadge = view.findViewById<TextView>(R.id.tvVersionBadge)
        val tvReleaseNotes = view.findViewById<TextView>(R.id.tvReleaseNotes)
        val btnLater = view.findViewById<Button>(R.id.btnLater)
        val btnUpdateNow = view.findViewById<Button>(R.id.btnUpdateNow)

        tvVersionBadge.text = "v${release.versionName}"
        tvReleaseNotes.text = formatMarkdownToSpanned(release.releaseNotes)
        tvReleaseNotes.movementMethod = LinkMovementMethod.getInstance()

        btnLater.setOnClickListener {
            dialog.dismiss()
        }

        btnUpdateNow.setOnClickListener {
            dialog.dismiss()
            checkInstallPermissionAndDownload(activity, release.apkDownloadUrl)
        }

        dialog.setCancelable(true)
        dialog.show()
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
