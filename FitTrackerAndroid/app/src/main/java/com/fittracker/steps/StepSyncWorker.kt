package com.fittracker.steps

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.fittracker.UserData
import com.fittracker.net.AppHttp
import com.fittracker.widget.FitTrackerWidgetUpdater
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException

/**
 * Uploads every day whose step total changed (today, and yesterday when a
 * reading closed it out after midnight), each under its own date.
 * Uses the WebView session cookie. A 401/403 means the session is gone: the
 * app stops syncing and the widgets show "signed out".
 */
class StepSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "StepSyncWorker"
        private const val MAX_ATTEMPTS = 8
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val context = applicationContext
        if (StepStore.isSignedOut(context)) {
            Log.d(TAG, "Signed out: nothing uploaded")
            return@withContext Result.success()
        }

        val uploads = StepRepository.pendingUploads(context)
        if (uploads.isEmpty()) return@withContext Result.success()

        var retry = false
        for ((date, steps) in uploads) {
            val payload = JSONObject()
                .put("steps", steps)
                .put("source", "step_counter")
                .put("dateString", date)
                .toString()

            val response = try {
                AppHttp.request(context, "POST", "/api/steps/sync", payload)
            } catch (e: IOException) {
                Log.w(TAG, "Network error uploading $date: ${e.message}")
                retry = true
                break
            }

            when (response.code) {
                in 200..299 -> {
                    StepRepository.markUploaded(context, date, steps)
                    StepStore.recordSuccessfulSync(context)
                }
                401, 403 -> {
                    Log.w(TAG, "Session rejected (${response.code}); stopping step sync")
                    UserData.onSessionLost(context)
                    return@withContext Result.success()
                }
                400, 422 -> {
                    // The server refuses this day (e.g. no longer today or yesterday in the user's zone).
                    Log.w(TAG, "Server rejected steps for $date: ${response.body?.take(200)}")
                    StepRepository.dropPending(context, date)
                }
                else -> {
                    Log.w(TAG, "Server error ${response.code} uploading $date")
                    retry = true
                    break
                }
            }
        }

        FitTrackerWidgetUpdater.updateAllWidgets(context)
        if (retry && runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.success()
    }
}
