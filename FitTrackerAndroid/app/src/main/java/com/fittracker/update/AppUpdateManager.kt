package com.fittracker.update

import android.app.Activity
import android.app.Dialog
import android.app.ProgressDialog
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
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
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Handles Over-The-Air (OTA) APK updates directly from GitHub Releases with streaming progress and Markdown rendering.
 */
class AppUpdateManager(private val context: Context) {

    companion object {
        private const val TAG = "AppUpdateManager"
        const val GITHUB_REPO_OWNER = "MOHAMED-EHAB-DEV"
        const val GITHUB_REPO_NAME = "fit-tracker"
        private const val RELEASES_API_URL =
            "https://api.github.com/repos/$GITHUB_REPO_OWNER/$GITHUB_REPO_NAME/releases/latest"

        // Prevent duplicate dialogs or nagging on every resume within the same app session
        private var isDialogShowing = false
        private var sessionDismissed = false
    }

    data class ReleaseInfo(
        val versionName: String,
        val versionCode: Int,
        val releaseNotes: String,
        val apkDownloadUrl: String
    )

    /**
     * Gets the real installed package version name from Android PackageManager.
     */
    fun getInstalledVersionName(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName?.removePrefix("v")?.trim() ?: BuildConfig.VERSION_NAME.removePrefix("v").trim()
        } catch (e: Exception) {
            BuildConfig.VERSION_NAME.removePrefix("v").trim()
        }
    }

    /**
     * Gets the real installed package version code from Android PackageManager.
     */
    fun getInstalledVersionCode(): Long {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
        } catch (e: Exception) {
            BuildConfig.VERSION_CODE.toLong()
        }
    }

    /**
     * Checks if a new release is available on GitHub and prompts user with styled changelog.
     */
    fun checkForUpdates(
        activity: Activity,
        silent: Boolean = true,
        onChecked: ((hasUpdate: Boolean, version: String?) -> Unit)? = null
    ) {
        if (silent && (isDialogShowing || sessionDismissed)) {
            Log.d(TAG, "Skipping silent update check (dialog showing: $isDialogShowing, dismissed: $sessionDismissed)")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val localName = getInstalledVersionName()
                val localCode = getInstalledVersionCode()
                Log.d(TAG, "Checking for updates at $RELEASES_API_URL... Local: v$localName (code: $localCode)")

                val release = fetchLatestRelease()

                withContext(Dispatchers.Main) {
                    if (activity.isFinishing || activity.isDestroyed) return@withContext

                    if (release != null) {
                        val hasUpdate = isNewerVersion(release.versionName, release.versionCode)
                        Log.d(TAG, "Fetched remote release v${release.versionName} (code: ${release.versionCode}). Update available: $hasUpdate")

                        if (hasUpdate) {
                            onChecked?.invoke(true, release.versionName)
                            showCustomUpdateDialog(activity, release)
                        } else {
                            onChecked?.invoke(false, localName)
                            if (!silent) {
                                Toast.makeText(
                                    activity,
                                    "FitTracker is up to date (v$localName)",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    } else {
                        Log.w(TAG, "No release info could be parsed from GitHub.")
                        onChecked?.invoke(false, localName)
                        if (!silent) {
                            Toast.makeText(
                                activity,
                                "FitTracker is up to date (v$localName)",
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
     * Fetches text content from URL following HTTP 301/302/307 redirects.
     */
    private fun fetchTextWithRedirects(urlString: String): String? {
        var currentUrl = urlString
        var redirects = 0
        while (redirects < 5) {
            val conn = URL(currentUrl).openConnection() as HttpURLConnection
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "FitTracker-Android-App")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            val status = conn.responseCode
            if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                val location = conn.getHeaderField("Location") ?: break
                currentUrl = location
                redirects++
                continue
            }
            if (status == 200) {
                return conn.inputStream.bufferedReader().use { it.readText() }
            }
            break
        }
        return null
    }

    /**
     * Fetches the latest release metadata from GitHub Releases API and resolves version.json.
     */
    private fun fetchLatestRelease(): ReleaseInfo? {
        val rootJsonStr = fetchTextWithRedirects(RELEASES_API_URL) ?: return null
        val root = JSONObject(rootJsonStr)

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

        // 1. Try to fetch metadata directly from version.json asset following redirects
        var resolvedVersionName: String? = null
        var resolvedVersionCode = 0
        var resolvedNotes: String = body

        if (!versionJsonUrl.isNullOrBlank()) {
            try {
                val vText = fetchTextWithRedirects(versionJsonUrl)
                if (!vText.isNullOrBlank()) {
                    val vJson = JSONObject(vText)
                    resolvedVersionName = vJson.optString("versionName", "")
                    resolvedVersionCode = vJson.optInt("versionCode", 0)
                    val customNotes = vJson.optString("releaseNotes", "")
                    if (customNotes.isNotBlank()) {
                        resolvedNotes = customNotes
                    }
                    Log.d(TAG, "Successfully resolved version.json asset: v$resolvedVersionName (code: $resolvedVersionCode)")
                }
            } catch (e: Exception) {
                Log.d(TAG, "version.json download failed: ${e.localizedMessage}")
            }
        }

        // 2. Fallback: Extract SemVer from release title (e.g. "FitTracker Android App v1.0.4")
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
     * Compares incoming version with local installed version and version code.
     */
    private fun isNewerVersion(remoteVersion: String, remoteCode: Int): Boolean {
        val localName = getInstalledVersionName()
        val localCode = getInstalledVersionCode()
        val cleanRemote = remoteVersion.removePrefix("v").trim()

        Log.d(TAG, "Comparing local: [name=$localName, code=$localCode] vs remote: [name=$cleanRemote, code=$remoteCode]")

        // 1. If remote versionCode is valid (> 0), integer comparison is primary
        if (remoteCode > 0 && localCode > 0) {
            return remoteCode > localCode
        }

        // 2. SemVer comparison: major.minor.patch
        if (cleanRemote.isBlank() || cleanRemote.equals("latest", ignoreCase = true) || localName == cleanRemote) {
            return false
        }

        return try {
            val currentParts = localName.split(".").map { it.toIntOrNull() ?: 0 }
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
            cleanRemote != localName
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
        if (isDialogShowing) return
        isDialogShowing = true

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

        // Compile and render full Markdown using Markwon
        try {
            val markwon = io.noties.markwon.Markwon.create(activity)
            markwon.setMarkdown(tvReleaseNotes, release.releaseNotes)
        } catch (e: Exception) {
            // Safe fallback if Markwon encountered an issue
            tvReleaseNotes.text = formatMarkdownToSpanned(release.releaseNotes)
            tvReleaseNotes.movementMethod = LinkMovementMethod.getInstance()
        }

        dialog.setOnDismissListener {
            isDialogShowing = false
        }

        btnLater.setOnClickListener {
            sessionDismissed = true
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
     * High-speed, streaming in-app APK downloader with progress dialog and 302 redirect resolution.
     */
    fun downloadAndInstallApk(activity: Activity, apkUrl: String) {
        val progressDialog = ProgressDialog(activity).apply {
            setTitle("Downloading FitTracker Update")
            setMessage("Please wait while the update is downloading...")
            setProgressStyle(ProgressDialog.STYLE_HORIZONTAL)
            isIndeterminate = false
            max = 100
            setCancelable(false)
            show()
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apkFile = File(activity.cacheDir, "FitTracker-update.apk")
                if (apkFile.exists()) {
                    apkFile.delete()
                }

                var currentUrl = apkUrl
                var redirects = 0
                var conn: HttpURLConnection? = null

                while (redirects < 5) {
                    conn = URL(currentUrl).openConnection() as HttpURLConnection
                    conn.instanceFollowRedirects = true
                    conn.setRequestProperty("User-Agent", "FitTracker-Android-App")
                    conn.connectTimeout = 15000
                    conn.readTimeout = 15000

                    val status = conn.responseCode
                    if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                        val location = conn.getHeaderField("Location") ?: break
                        currentUrl = location
                        redirects++
                        continue
                    }
                    break
                }

                if (conn == null || conn.responseCode != 200) {
                    throw Exception("Server returned HTTP ${conn?.responseCode}")
                }

                val fileLength = conn.contentLength
                val input = conn.inputStream
                val output = FileOutputStream(apkFile)

                val data = ByteArray(8192)
                var total: Long = 0
                var count: Int

                while (input.read(data).also { count = it } != -1) {
                    total += count
                    if (fileLength > 0) {
                        val progress = ((total * 100) / fileLength).toInt()
                        withContext(Dispatchers.Main) {
                            progressDialog.progress = progress
                        }
                    }
                    output.write(data, 0, count)
                }

                output.flush()
                output.close()
                input.close()

                withContext(Dispatchers.Main) {
                    try {
                        if (progressDialog.isShowing && !activity.isFinishing && !activity.isDestroyed) {
                            progressDialog.dismiss()
                        }
                    } catch (_: Exception) {}

                    if (apkFile.exists() && apkFile.length() > 500_000) {
                        installApk(activity, apkFile)
                    } else {
                        Toast.makeText(
                            activity,
                            "Downloaded APK is incomplete or corrupted. Please try again.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Download error: ${e.localizedMessage}", e)
                withContext(Dispatchers.Main) {
                    try {
                        if (progressDialog.isShowing && !activity.isFinishing && !activity.isDestroyed) {
                            progressDialog.dismiss()
                        }
                    } catch (_: Exception) {}
                    Toast.makeText(
                        activity,
                        "Failed to download update: ${e.localizedMessage}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
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
