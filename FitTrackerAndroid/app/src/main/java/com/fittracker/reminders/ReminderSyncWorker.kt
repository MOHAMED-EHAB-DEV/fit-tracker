package com.fittracker.reminders

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.fittracker.UserData
import com.fittracker.net.AppHttp
import com.fittracker.steps.StepStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException

/**
 * Refreshes the reminder schedule from GET /api/planner/upcoming (today and
 * tomorrow in the user's zone) so recurring events keep firing even when the
 * app is not opened every day.
 */
class ReminderSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "ReminderSyncWorker"
        private const val PERIODIC_NAME = "fit_tracker_reminder_sync"
        private const val ONE_TIME_NAME = "fit_tracker_reminder_sync_now"

        private val constraints: Constraints
            get() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<ReminderSyncWorker>(6, java.util.concurrent.TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, java.util.concurrent.TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        fun syncNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<ReminderSyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request)
        }

        fun cancelAll(context: Context) {
            val workManager = WorkManager.getInstance(context)
            workManager.cancelUniqueWork(PERIODIC_NAME)
            workManager.cancelUniqueWork(ONE_TIME_NAME)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val context = applicationContext
        if (StepStore.isSignedOut(context)) return@withContext Result.success()

        val response = try {
            AppHttp.request(context, "GET", "/api/planner/upcoming")
        } catch (e: IOException) {
            Log.w(TAG, "Network error: ${e.message}")
            return@withContext Result.retry()
        }

        when (response.code) {
            in 200..299 -> {
                val reminders = try {
                    val json = JSONObject(response.body ?: "")
                    if (!json.optBoolean("success", false)) null else ReminderScheduler.parse(json.optJSONArray("reminders"))
                } catch (e: Exception) {
                    null
                }
                if (reminders == null) {
                    Log.w(TAG, "Unexpected response from /api/planner/upcoming")
                    Result.retry()
                } else {
                    ReminderScheduler.replaceAll(context, reminders)
                    Result.success()
                }
            }
            401, 403 -> {
                UserData.onSessionLost(context)
                Result.success()
            }
            else -> if (runAttemptCount < 5) Result.retry() else Result.success()
        }
    }
}
