package com.fittracker

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import com.fittracker.webview.JSBridge

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var jsBridge: JSBridge

    // Configurable endpoint (local emulator default or production domain)
    private val appUrl = "https://fit-tracker-ai-prod.vercel.app/"

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACTIVITY_RECOGNITION] == true) {
            StepSyncScheduler.schedulePeriodicSync(this)
            jsBridge.requestStepSync()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Store active base URL for background sync
        StepStore.setServerUrl(this, appUrl)

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
            }

            // Ensure cookies are saved and synced
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    cookieManager.flush()
                    // Push initial step count to the loaded page
                    val cachedSteps = StepRepository.getCachedTodaySteps(this@MainActivity)
                    jsBridge.pushStepCount(cachedSteps)
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    return false // Keep inside WebView
                }
            }

            webChromeClient = WebChromeClient()

            jsBridge = JSBridge(this@MainActivity, this)
            addJavascriptInterface(jsBridge, "AndroidBridge")
        }

        setContentView(webView)

        checkAndRequestPermissions()
        StepSyncScheduler.schedulePeriodicSync(this)

        webView.loadUrl(appUrl)
    }

    override fun onResume() {
        super.onResume()
        // If activity recognition permission is granted, perform a fresh fast step check
        if (hasActivityRecognitionPermission()) {
            jsBridge.requestStepSync()
        }
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
