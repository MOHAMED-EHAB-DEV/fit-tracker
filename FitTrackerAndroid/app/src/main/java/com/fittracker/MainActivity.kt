package com.fittracker

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.hardware.SensorEventListener
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.RenderProcessGoneDetail
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.fittracker.reminders.ReminderSyncWorker
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepSensorManager
import com.fittracker.steps.StepSnapshot
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import com.fittracker.update.AppUpdateManager
import com.fittracker.webview.BridgeHost
import com.fittracker.webview.JSBridge
import com.fittracker.widget.FitTrackerWidgetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity(), BridgeHost {

    companion object {
        private const val TAG = "MainActivity"
        const val ACTION_OPEN_ROUTE = "com.fittracker.action.OPEN_ROUTE"
        const val ACTION_ENABLE_STEPS = "com.fittracker.action.ENABLE_STEPS"
        const val EXTRA_ROUTE = "com.fittracker.extra.ROUTE"

        private const val STATE_CAMERA_PATH = "camera_photo_path"
        private const val STATE_SAVE_PATH = "pending_save_path"

        private const val PERMISSION_PREFS = "fit_tracker_permissions"
        private const val TEMP_FILE_MAX_AGE_MS = 6L * 60 * 60 * 1000
        private const val STEPS_EVENT = "fit-tracker-steps-update"
    }

    private var webView: WebView? = null
    private lateinit var webContainer: FrameLayout
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorMessage: TextView
    private lateinit var updateManager: AppUpdateManager

    private val activityScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var liveStepListener: SensorEventListener? = null
    private var pageFailed = false
    private var lastFailedUrl: String? = null
    private var notificationPromptShown = false

    // File chooser state (the camera photo path survives process death via onSaveInstanceState).
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingChooserParams: WebChromeClient.FileChooserParams? = null
    private var cameraPhotoPath: String? = null
    private var pendingSavePath: String? = null

    private val stepListener: (StepSnapshot) -> Unit = { snapshot ->
        runOnUiThread {
            pushSteps(snapshot, "live")
            FitTrackerWidgetUpdater.updateAllWidgetsThrottled(applicationContext)
        }
    }

    // ---- activity results ---------------------------------------------------

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result -> onFileChooserResult(result.resultCode, result.data) }

    private val saveDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result -> onSaveDocumentResult(result.resultCode, result.data?.data) }

    private val stepPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        StepRepository.setPermissionDenied(this, !granted)
        if (granted) {
            startLiveSteps()
            readStepsNow("sync")
        } else {
            pushSteps(StepRepository.snapshot(this), "sync")
        }
        FitTrackerWidgetUpdater.updateAllWidgets(this)
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> launchFileChooser(includeCamera = granted) }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> /* The web app reads the result through getReminderStatus(). */ }

    // ---- lifecycle ----------------------------------------------------------

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webContainer = findViewById(R.id.webview_container)
        errorView = findViewById(R.id.error_view)
        errorTitle = findViewById(R.id.error_title)
        errorMessage = findViewById(R.id.error_message)
        findViewById<Button>(R.id.error_retry).setOnClickListener { retryLoad() }

        cameraPhotoPath = savedInstanceState?.getString(STATE_CAMERA_PATH)
        pendingSavePath = savedInstanceState?.getString(STATE_SAVE_PATH)
        updateManager = AppUpdateManager(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            /** Goes back one page, or leaves the app when there is no earlier page. */
            private fun navigateBack() {
                val view = webView
                if (view != null && errorView.visibility != View.VISIBLE && view.canGoBack()) {
                    view.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }

            /** Id of the press still waiting for the page's answer (0 = none). */
            private var waitingFor = 0
            private var nextPressId = 0

            override fun handleOnBackPressed() {
                val view = webView
                // No page to ask, a page that is not the app's own, or a second press
                // while the page has not answered the first (renderer busy or hung):
                // go back without asking, so Back can never get stuck.
                if (view == null || errorView.visibility == View.VISIBLE || waitingFor != 0 || !AppConfig.isAppUrl(view.url)) {
                    waitingFor = 0
                    navigateBack()
                    return
                }
                // The page gets the first say: an open dialog or sheet closes
                // instead of the page going back (see lib/ui/overlay-stack.ts).
                val pressId = ++nextPressId
                waitingFor = pressId
                view.evaluateJavascript(
                    "(function(){try{return !!(window.__ftHandleBack&&window.__ftHandleBack())}catch(e){return false}})()"
                ) { handled ->
                    if (waitingFor != pressId || isFinishing || isDestroyed) return@evaluateJavascript
                    waitingFor = 0
                    if (handled != "true") navigateBack()
                }
            }
        })

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val view = createWebView()
        webContainer.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        webView = view

        StepRepository.addListener(stepListener)
        cleanupTempFiles()

        val restored = savedInstanceState != null && view.restoreState(savedInstanceState) != null
        if (!restored) view.loadUrl(initialUrl(intent))

        if (!StepStore.isSignedOut(this)) {
            StepSyncScheduler.schedulePeriodicSync(this)
            ReminderSyncWorker.schedulePeriodic(this)
            ReminderSyncWorker.syncNow(this)
        }

        if (savedInstanceState == null) {
            updateManager.checkForUpdates(this, silent = true)
            if (intent?.action == ACTION_ENABLE_STEPS) requestStepSync()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        when (intent.action) {
            ACTION_OPEN_ROUTE -> {
                val route = intent.getStringExtra(EXTRA_ROUTE)
                if (AppConfig.isSafeRoute(route)) webView?.loadUrl(AppConfig.APP_ORIGIN + route)
            }
            ACTION_ENABLE_STEPS -> requestStepSync()
            // Widget and launcher taps just bring the running app to the front.
        }
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        updateManager.resumePendingInstall(this)
        startLiveSteps()
        if (StepSensorManager.hasActivityPermission(this) && StepSensorManager.isSupported(this)) {
            readStepsNow("live")
        }
        FitTrackerWidgetUpdater.updateAllWidgets(this)
    }

    override fun onPause() {
        stopLiveSteps()
        webView?.onPause()
        try {
            CookieManager.getInstance().flush()
        } catch (_: Exception) {
        }
        if (!StepStore.isSignedOut(this) && StepRepository.pendingUploads(this).isNotEmpty()) {
            StepSyncScheduler.syncNow(this)
        }
        FitTrackerWidgetUpdater.updateAllWidgets(this)
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView?.saveState(outState)
        outState.putString(STATE_CAMERA_PATH, cameraPhotoPath)
        outState.putString(STATE_SAVE_PATH, pendingSavePath)
    }

    override fun onDestroy() {
        activityScope.cancel()
        StepRepository.removeListener(stepListener)
        stopLiveSteps()
        updateManager.dismissDialogs()
        filePathCallback = null
        destroyWebView()
        super.onDestroy()
    }

    private fun destroyWebView() {
        val view = webView ?: return
        webView = null
        try {
            view.removeJavascriptInterface("AndroidBridge")
            view.stopLoading()
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
        } catch (e: Exception) {
            Log.w(TAG, "WebView teardown failed: ${e.message}")
        }
    }

    // ---- WebView ------------------------------------------------------------

    private fun initialUrl(intent: Intent?): String {
        val route = intent?.takeIf { it.action == ACTION_OPEN_ROUTE }?.getStringExtra(EXTRA_ROUTE)
        return if (AppConfig.isSafeRoute(route)) AppConfig.APP_ORIGIN + route else AppConfig.startUrl
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView = WebView(this).apply {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = true
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(this, false)

        webViewClient = AppWebViewClient()
        webChromeClient = AppChromeClient()
        setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            handleDownload(url, contentDisposition, mimeType)
        }
        addJavascriptInterface(JSBridge(this@MainActivity, this@MainActivity), "AndroidBridge")
    }

    private inner class AppWebViewClient : WebViewClient() {

        /** Only the app's own origin loads here; everything else opens in the system browser. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (AppConfig.isAppUri(uri)) return false
            if (request.isForMainFrame) openExternal(uri.toString())
            return true
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            pageFailed = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            super.onPageFinished(view, url)
            try {
                CookieManager.getInstance().flush()
            } catch (_: Exception) {
            }
            if (!pageFailed) {
                errorView.visibility = View.GONE
                webContainer.visibility = View.VISIBLE
                pushSteps(StepRepository.snapshot(this@MainActivity), "cache")
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            super.onReceivedError(view, request, error)
            if (!request.isForMainFrame) return
            pageFailed = true
            lastFailedUrl = request.url?.toString()
            Log.w(TAG, "Main frame failed to load: ${error.errorCode} ${error.description}")
            showErrorPage()
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // Only called on API 26+ (where RenderProcessGoneDetail exists).
            Log.e(TAG, "WebView renderer process gone; recreating the screen")
            if (view == webView) {
                webView = null
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                recreate()
            }
            return true
        }
    }

    private inner class AppChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            callback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            filePathCallback?.onReceiveValue(null)
            filePathCallback = callback
            pendingChooserParams = fileChooserParams

            val wantsImages = acceptsImages(fileChooserParams)
            val hasCamera = packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
            if (!wantsImages || !hasCamera) {
                launchFileChooser(includeCamera = false)
            } else if (isGranted(Manifest.permission.CAMERA)) {
                launchFileChooser(includeCamera = true)
            } else if (isPermanentlyDenied(Manifest.permission.CAMERA)) {
                launchFileChooser(includeCamera = false)
            } else {
                showRationale(
                    R.string.perm_camera_title,
                    R.string.perm_camera_message,
                    onContinue = {
                        markAsked(Manifest.permission.CAMERA)
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    },
                    onCancel = { launchFileChooser(includeCamera = false) }
                )
            }
            return true
        }
    }

    private fun isOnline(): Boolean {
        val manager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun showErrorPage() {
        val offline = !isOnline()
        errorTitle.setText(if (offline) R.string.error_offline_title else R.string.error_load_title)
        errorMessage.setText(if (offline) R.string.error_offline_message else R.string.error_load_message)
        errorView.visibility = View.VISIBLE
        webContainer.visibility = View.INVISIBLE
    }

    private fun retryLoad() {
        val view = webView ?: return
        val target = lastFailedUrl?.takeIf { AppConfig.isAppUrl(it) } ?: AppConfig.startUrl
        pageFailed = false
        errorView.visibility = View.GONE
        webContainer.visibility = View.VISIBLE
        view.loadUrl(target)
    }

    // ---- steps --------------------------------------------------------------

    private fun startLiveSteps() {
        if (liveStepListener != null) return
        liveStepListener = StepSensorManager.startLive(applicationContext) { reading ->
            try {
                StepRepository.processReading(applicationContext, reading)
            } catch (e: Exception) {
                Log.w(TAG, "Live step reading failed: ${e.message}")
            }
        }
    }

    private fun stopLiveSteps() {
        StepSensorManager.stopLive(applicationContext, liveStepListener)
        liveStepListener = null
    }

    private fun readStepsNow(reason: String) {
        activityScope.launch {
            val snapshot = withContext(Dispatchers.IO) {
                StepRepository.readAndProcess(applicationContext)
            }
            pushSteps(snapshot, reason)
            if (!StepStore.isSignedOut(applicationContext)) StepSyncScheduler.syncNow(applicationContext)
            FitTrackerWidgetUpdater.updateAllWidgets(applicationContext)
        }
    }

    /** Sends the step total to the page (only when the page is the app's own). */
    private fun pushSteps(snapshot: StepSnapshot, reason: String) {
        val view = webView ?: return
        if (!AppConfig.isAppUrl(view.url)) return
        val detail = JSONObject()
            .put("steps", snapshot.steps)
            .put("date", snapshot.date)
            .put("timestamp", System.currentTimeMillis())
            .put("reason", reason)
            .put("status", snapshot.status)
            .toString()
        val js = "(function(){try{var d=$detail;" +
            "window.dispatchEvent(new CustomEvent('$STEPS_EVENT',{detail:d}));" +
            "if(window.__fitBridge&&typeof window.__fitBridge.onStepUpdate==='function'){window.__fitBridge.onStepUpdate(d.steps);}" +
            "}catch(e){}})();"
        view.evaluateJavascript(js, null)
    }

    override fun requestStepSync() {
        if (!StepSensorManager.isSupported(this)) {
            pushSteps(StepRepository.snapshot(this), "sync")
            return
        }
        if (StepSensorManager.hasActivityPermission(this)) {
            readStepsNow("sync")
            return
        }
        // Android 10+: ask in context, with a reason and a way to settings after a refusal.
        val permission = Manifest.permission.ACTIVITY_RECOGNITION
        if (isPermanentlyDenied(permission)) {
            StepRepository.setPermissionDenied(this, true)
            pushSteps(StepRepository.snapshot(this), "sync")
            showSettingsDialog(R.string.perm_activity_title, R.string.perm_activity_denied)
            return
        }
        showRationale(
            R.string.perm_activity_title,
            R.string.perm_activity_message,
            onContinue = {
                markAsked(permission)
                stepPermissionLauncher.launch(permission)
            },
            onCancel = { pushSteps(StepRepository.snapshot(this), "sync") }
        )
    }

    // ---- permissions helpers ------------------------------------------------

    private fun isGranted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun wasAsked(permission: String): Boolean =
        getSharedPreferences(PERMISSION_PREFS, Context.MODE_PRIVATE).getBoolean(permission, false)

    private fun markAsked(permission: String) {
        getSharedPreferences(PERMISSION_PREFS, Context.MODE_PRIVATE).edit().putBoolean(permission, true).apply()
    }

    /** Asked before, refused, and Android will no longer show its dialog. */
    private fun isPermanentlyDenied(permission: String): Boolean =
        wasAsked(permission) && !isGranted(permission) && !shouldShowRequestPermissionRationale(permission)

    private fun showRationale(titleRes: Int, messageRes: Int, onContinue: () -> Unit, onCancel: () -> Unit) {
        if (isFinishing || isDestroyed) return
        var continued = false
        AlertDialog.Builder(this)
            .setTitle(titleRes)
            .setMessage(messageRes)
            .setPositiveButton(R.string.perm_continue) { _, _ ->
                continued = true
                onContinue()
            }
            .setNegativeButton(R.string.perm_not_now, null)
            .setOnDismissListener { if (!continued) onCancel() }
            .show()
    }

    private fun showSettingsDialog(titleRes: Int, messageRes: Int) {
        if (isFinishing || isDestroyed) return
        AlertDialog.Builder(this)
            .setTitle(titleRes)
            .setMessage(messageRes)
            .setPositiveButton(R.string.perm_open_settings) { _, _ -> openAppSettings() }
            .setNegativeButton(R.string.perm_not_now, null)
            .show()
    }

    override fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val permission = Manifest.permission.POST_NOTIFICATIONS
        if (isGranted(permission) || isPermanentlyDenied(permission) || notificationPromptShown) return
        notificationPromptShown = true
        showRationale(
            R.string.perm_notifications_title,
            R.string.perm_notifications_message,
            onContinue = {
                markAsked(permission)
                notificationPermissionLauncher.launch(permission)
            },
            onCancel = {}
        )
    }

    override fun openNotificationSettings() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
        }
        startSettings(intent)
    }

    override fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        startSettings(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName")))
    }

    override fun openAppSettings() {
        startSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
    }

    private fun startSettings(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
            } catch (e: Exception) {
                Log.w(TAG, "No settings screen available: ${e.message}")
            }
        }
    }

    // ---- bridge host --------------------------------------------------------

    override fun currentMainFrameUrl(): String? = webView?.url

    override fun checkForUpdate() {
        updateManager.checkForUpdates(this, silent = false)
    }

    override fun openExternal(url: String): Boolean {
        val uri = try {
            Uri.parse(url)
        } catch (_: Exception) {
            return false
        }
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme !in setOf("https", "http", "mailto", "tel")) return false
        if (AppConfig.isAppUri(uri)) {
            webView?.loadUrl(uri.toString())
            return true
        }
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addCategory(Intent.CATEGORY_BROWSABLE)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show()
            false
        }
    }

    // ---- file chooser -------------------------------------------------------

    private fun requestedMimeTypes(params: WebChromeClient.FileChooserParams?): List<String> {
        val raw = params?.acceptTypes.orEmpty()
            .flatMap { it.split(",") }
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }
        return raw.mapNotNull { type ->
            when {
                type.startsWith(".") -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(type.removePrefix("."))
                type.contains("/") -> type
                else -> null
            }
        }.distinct()
    }

    private fun acceptsImages(params: WebChromeClient.FileChooserParams?): Boolean {
        val types = requestedMimeTypes(params)
        return types.isEmpty() || types.any { it.startsWith("image/") || it == "*/*" }
    }

    private fun cameraDir(): File = File(cacheDir, "camera").apply { mkdirs() }

    private fun createCameraIntent(): Intent? {
        return try {
            val photoFile = File.createTempFile("capture_", ".jpg", cameraDir())
            val photoUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                clipData = ClipData.newUri(contentResolver, "photo", photoUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
            if (intent.resolveActivity(packageManager) == null) {
                photoFile.delete()
                return null
            }
            cameraPhotoPath = photoFile.absolutePath
            intent
        } catch (e: Exception) {
            Log.e(TAG, "Could not prepare the camera: ${e.message}")
            null
        }
    }

    private fun launchFileChooser(includeCamera: Boolean) {
        if (filePathCallback == null) return
        val params = pendingChooserParams
        val mimeTypes = requestedMimeTypes(params)
        val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            if (mimeTypes.size == 1) {
                type = mimeTypes[0]
            } else {
                type = "*/*"
                if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
            }
            if (params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }

        val cameraIntent = if (includeCamera) createCameraIntent() else null
        val chooser = Intent.createChooser(contentIntent, getString(R.string.chooser_title)).apply {
            if (cameraIntent != null) putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
        }
        try {
            fileChooserLauncher.launch(chooser)
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "No file picker available: ${e.message}")
            onFileChooserResult(Activity.RESULT_CANCELED, null)
        }
    }

    private fun onFileChooserResult(resultCode: Int, data: Intent?) {
        val callback = filePathCallback
        filePathCallback = null
        pendingChooserParams = null
        val photoPath = cameraPhotoPath
        cameraPhotoPath = null
        val photoFile = photoPath?.let { File(it) }
        val photoUri = photoFile?.let {
            try {
                FileProvider.getUriForFile(this, "$packageName.fileprovider", it)
            } catch (_: Exception) {
                null
            }
        }

        var results: Array<Uri>? = null
        if (resultCode == Activity.RESULT_OK) {
            val clip = data?.clipData
            val single = data?.data
            results = when {
                clip != null && clip.itemCount > 0 ->
                    (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }.toTypedArray()
                single != null -> arrayOf(single)
                photoFile != null && photoUri != null && photoFile.length() > 0 -> arrayOf(photoUri)
                else -> null
            }
            if (results != null && results.isEmpty()) results = null
        }

        // A capture file that was not used (gallery pick or cancel) is deleted right away.
        if (photoFile != null && (results == null || photoUri == null || results.none { it == photoUri })) {
            photoFile.delete()
        }

        if (callback != null) {
            callback.onReceiveValue(results)
        } else if (results != null) {
            // The page that asked for the file is gone (Android closed the app meanwhile).
            Toast.makeText(this, R.string.photo_lost, Toast.LENGTH_LONG).show()
            photoFile?.delete()
        }
    }

    /** Deletes old camera captures and unsaved exports (uploads finish long before). */
    private fun cleanupTempFiles() {
        val cutoff = System.currentTimeMillis() - TEMP_FILE_MAX_AGE_MS
        listOf(File(cacheDir, "camera"), File(cacheDir, "exports")).forEach { dir ->
            dir.listFiles()?.forEach { file ->
                if (file.lastModified() < cutoff && file.absolutePath != pendingSavePath) file.delete()
            }
        }
    }

    // ---- downloads ----------------------------------------------------------

    private fun handleDownload(url: String, contentDisposition: String?, mimeType: String?) {
        val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
        val safeMime = mimeType?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
        when {
            url.startsWith("blob:") || AppConfig.isAppUrl(url) -> {
                // Let the page read the file (same origin, with its session) and hand it over.
                val js = "(function(){var u=${JSONObject.quote(url)},n=${JSONObject.quote(filename)}," +
                    "m=${JSONObject.quote(safeMime)};function fail(){window.AndroidBridge.saveFile('',n,m);}" +
                    "fetch(u,{credentials:'include'}).then(function(r){if(!r.ok)throw new Error('http');return r.blob();})" +
                    ".then(function(b){var f=new FileReader();f.onload=function(){var s=String(f.result);" +
                    "window.AndroidBridge.saveFile(s.substring(s.indexOf(',')+1),n,b.type||m);};f.onerror=fail;" +
                    "f.readAsDataURL(b);}).catch(fail);})();"
                webView?.evaluateJavascript(js, null)
            }
            url.startsWith("data:") -> {
                val comma = url.indexOf(',')
                val header = if (comma > 0) url.substring(5, comma) else ""
                if (comma > 0 && header.endsWith(";base64")) {
                    val dataMime = header.removeSuffix(";base64").ifBlank { safeMime }
                    saveFile(url.substring(comma + 1), filename, dataMime)
                } else {
                    reportSaveFailure(false)
                }
            }
            else -> openExternal(url)
        }
    }

    override fun reportSaveFailure(tooLarge: Boolean) {
        Toast.makeText(
            this,
            if (tooLarge) R.string.file_too_large else R.string.file_save_failed,
            Toast.LENGTH_LONG
        ).show()
    }

    /** Writes the file to the cache, then lets the user pick where to save it. */
    override fun saveFile(base64: String, filename: String, mimeType: String): Boolean {
        if (base64.isEmpty()) {
            reportSaveFailure(false)
            return false
        }
        val safeName = filename.replace(Regex("[^A-Za-z0-9._\\- ]"), "_").trim().take(100).ifBlank { "fittracker-export" }
        activityScope.launch {
            val file = withContext(Dispatchers.IO) {
                try {
                    val bytes = Base64.decode(base64, Base64.DEFAULT)
                    val dir = File(cacheDir, "exports").apply { mkdirs() }
                    File(dir, "${System.currentTimeMillis()}_$safeName").apply { writeBytes(bytes) }
                } catch (e: Exception) {
                    Log.e(TAG, "Could not prepare the file: ${e.message}")
                    null
                }
            }
            if (file == null) {
                reportSaveFailure(false)
                return@launch
            }
            pendingSavePath?.let { File(it).delete() }
            pendingSavePath = file.absolutePath
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mimeType
                putExtra(Intent.EXTRA_TITLE, safeName)
            }
            try {
                saveDocumentLauncher.launch(intent)
            } catch (e: ActivityNotFoundException) {
                file.delete()
                pendingSavePath = null
                reportSaveFailure(false)
            }
        }
        return true
    }

    private fun onSaveDocumentResult(resultCode: Int, target: Uri?) {
        val source = pendingSavePath?.let { File(it) }
        pendingSavePath = null
        if (source == null || !source.isFile) {
            if (resultCode == Activity.RESULT_OK) reportSaveFailure(false)
            return
        }
        if (resultCode != Activity.RESULT_OK || target == null) {
            source.delete()
            Toast.makeText(this, R.string.file_save_cancelled, Toast.LENGTH_SHORT).show()
            return
        }
        activityScope.launch {
            val saved = withContext(Dispatchers.IO) {
                try {
                    contentResolver.openOutputStream(target)?.use { output ->
                        source.inputStream().use { input -> input.copyTo(output) }
                        true
                    } ?: false
                } catch (e: Exception) {
                    Log.e(TAG, "Could not save the file: ${e.message}")
                    false
                } finally {
                    source.delete()
                }
            }
            Toast.makeText(
                this@MainActivity,
                if (saved) R.string.file_saved else R.string.file_save_failed,
                Toast.LENGTH_SHORT
            ).show()
        }
    }
}
