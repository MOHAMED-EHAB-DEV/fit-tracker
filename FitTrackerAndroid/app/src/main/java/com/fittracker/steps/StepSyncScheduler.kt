package com.fittracker.steps

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object StepSyncScheduler {

    private const val UNIQUE_PERIODIC_WORK_NAME = "fit_tracker_step_sync"
    private const val UNIQUE_ONE_TIME_WORK_NAME = "fit_tracker_step_sync_immediate"

    /**
     * Schedules low-power background step synchronization every 30 minutes.
     * Respects Android battery saver and Doze constraints.
     */
    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        val syncWorkRequest = PeriodicWorkRequestBuilder<StepSyncWorker>(
            repeatInterval = 30, TimeUnit.MINUTES,
            flexTimeInterval = 10, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES)
            .addTag(UNIQUE_PERIODIC_WORK_NAME)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncWorkRequest
        )
    }

    /**
     * Triggers an immediate one-time sync (e.g., when the user opens the dashboard).
     */
    fun syncNow(context: Context) {
        val syncWorkRequest = OneTimeWorkRequestBuilder<StepSyncWorker>()
            .addTag(UNIQUE_ONE_TIME_WORK_NAME)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_ONE_TIME_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )
    }
}
