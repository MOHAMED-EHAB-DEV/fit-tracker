package com.fittracker.steps

import android.content.Context
import android.util.Log
import android.webkit.CookieManager
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.fittracker.webview.JSBridge
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Battery-optimized background worker to sync step counts with Next.js backend.
 * Uses low-overhead HTTP connection with authentication support (Cookies and Bearer Token).
 */
class StepSyncWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "StepSyncWorker"
        private const val CONNECT_TIMEOUT_MS = 5000
        private const val READ_TIMEOUT_MS = 5000
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // 1. One-shot sensor read with strict timeout
            val currentReading = StepSensorManager.readCurrentCount(context)

            // 2. Process delta & compute today's steps
            val todayTotalSteps: Long = if (currentReading != null) {
                StepRepository.processNewSensorReading(context, currentReading)
            } else {
                // If stationary/timed out, use last cached value for today
                StepRepository.getCachedTodaySteps(context)
            }

            // Always update UI if WebView is currently active in foreground
            JSBridge.instance?.pushStepCount(todayTotalSteps)

            // 3. Resolve server URL & auth credentials
            val baseUrl = StepStore.getServerUrl(context)
            val syncEndpoint = "$baseUrl/api/steps/sync"
            val authToken = StepStore.getAuthToken(context)
            val cookie = try {
                CookieManager.getInstance()?.getCookie(baseUrl)
            } catch (_: Exception) {
                null
            }

            // If user has not logged in yet, complete locally without network call
            if (authToken.isNullOrBlank() && cookie.isNullOrBlank()) {
                Log.d(TAG, "No auth token or session cookie found. Step count recorded locally: $todayTotalSteps")
                return@withContext Result.success()
            }

            // 4. Dispatch HTTP POST request to Fit Tracker backend
            val todayStr = StepStore.getTodayDateString()
            val jsonPayload = """{"steps": $todayTotalSteps, "source": "step_counter", "dateString": "$todayStr"}"""

            val url = URL(syncEndpoint)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                if (!authToken.isNullOrBlank()) {
                    setRequestProperty("Authorization", "Bearer $authToken")
                }
                if (!cookie.isNullOrBlank()) {
                    setRequestProperty("Cookie", cookie)
                }
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                doOutput = true
            }

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(jsonPayload)
                writer.flush()
            }

            val responseCode = connection.responseCode
            connection.disconnect()

            Log.d(TAG, "Step sync HTTP response: $responseCode for steps: $todayTotalSteps")

            return@withContext when (responseCode) {
                in 200..299 -> {
                    StepStore.recordSuccessfulSync(context)
                    Result.success()
                }
                401, 403 -> {
                    // Session expired or unauthenticated - don't retry endlessly
                    Log.w(TAG, "Unauthorized during background step sync (code $responseCode). Will not retry until re-authenticated.")
                    Result.success()
                }
                else -> {
                    Log.w(TAG, "Server returned error code $responseCode during step sync.")
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "StepSyncWorker failed with exception: ${e.localizedMessage}")
            Result.retry()
        }
    }
}
