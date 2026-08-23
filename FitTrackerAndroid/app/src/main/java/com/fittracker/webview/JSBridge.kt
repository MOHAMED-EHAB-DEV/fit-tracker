package com.fittracker.webview

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepSensorManager
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * JavaScript Bridge exposed to the Next.js WebView as `window.AndroidBridge`.
 * Enables high-performance, asynchronous bidirectional communication for step counting,
 * session authentication, and live dashboard telemetry.
 */
class JSBridge(
    private val context: Context,
    private val webView: WebView
) {

    companion object {
        private const val TAG = "JSBridge"
        var instance: JSBridge? = null
            private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val bridgeScope = CoroutineScope(Dispatchers.Main)

    init {
        instance = this
    }

    /**
     * Lets Next.js frontend know it is running inside the native Android wrapper.
     */
    @JavascriptInterface
    fun isNativeApp(): Boolean {
        return true
    }

    /**
     * Synchronously returns today's cached step count without blocking on hardware sensors.
     */
    @JavascriptInterface
    fun getTodaySteps(): Long {
        return StepRepository.getCachedTodaySteps(context)
    }

    /**
     * Returns JSON metadata describing the active hardware sensor.
     */
    @JavascriptInterface
    fun getSensorInfo(): String {
        val meta = StepSensorManager.getActiveSensorMetadata(context)
        return if (meta != null) {
            """{"name":"${meta.name}","vendor":"${meta.vendor}","version":${meta.version},"powerMa":${meta.powerMa},"type":"${meta.type}","isWakeUp":${meta.isWakeUp}}"""
        } else {
            """{"name":"Unavailable","vendor":"None","version":0,"powerMa":0,"type":"NONE","isWakeUp":false}"""
        }
    }

    /**
     * Request an immediate hardware pedometer refresh and push the result to the UI.
     */
    @JavascriptInterface
    fun requestStepSync() {
        bridgeScope.launch(Dispatchers.IO) {
            try {
                val currentReading = StepSensorManager.readCurrentCount(context)
                val todaySteps = if (currentReading != null) {
                    StepRepository.processNewSensorReading(context, currentReading)
                } else {
                    StepRepository.getCachedTodaySteps(context)
                }

                pushStepCount(todaySteps)
                StepSyncScheduler.syncNow(context)
            } catch (e: Exception) {
                Log.e(TAG, "Error during requested step sync: ${e.localizedMessage}")
            }
        }
    }

    /**
     * Stores the authenticated JWT session token for background WorkManager tasks.
     */
    @JavascriptInterface
    fun setAuthToken(token: String?) {
        if (!token.isNullOrBlank()) {
            StepStore.setAuthToken(context, token)
            Log.d(TAG, "Auth token synchronized with Android native store.")
        }
    }

    /**
     * Updates the server base URL (useful when switching environments).
     */
    @JavascriptInterface
    fun setServerUrl(url: String?) {
        if (!url.isNullOrBlank()) {
            StepStore.setServerUrl(context, url)
            Log.d(TAG, "Server base URL set to: $url")
        }
    }

    /**
     * Pushes the latest step count to Next.js by dispatching DOM events and bridge callbacks.
     */
    fun pushStepCount(steps: Long) {
        mainHandler.post {
            try {
                val js = """
                    (function() {
                        try {
                            const stepCount = $steps;
                            window.dispatchEvent(new CustomEvent('fit-tracker-steps-update', { 
                                detail: { steps: stepCount, timestamp: Date.now() } 
                            }));
                            if (window.__fitBridge && typeof window.__fitBridge.onStepUpdate === 'function') {
                                window.__fitBridge.onStepUpdate(stepCount);
                            }
                        } catch(e) {
                            console.error('Failed to dispatch native step event:', e);
                        }
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to evaluate JS on WebView: ${e.localizedMessage}")
            }
        }
    }
}
