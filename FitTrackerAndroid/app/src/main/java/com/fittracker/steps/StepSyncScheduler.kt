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

/**
 * Uploads stored step totals. The workers never read the sensor (Android does
 * not deliver step events to background apps); they upload what was read while
 * the app was open or after a widget Sync.
 */
object StepSyncScheduler {

    private const val UNIQUE_PERIODIC_WORK_NAME = "fit_tracker_step_sync"
    private const val UNIQUE_ONE_TIME_WORK_NAME = "fit_tracker_step_sync_immediate"

    private val networkConstraints: Constraints
        get() = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

    fun schedulePeriodicSync(context: Context) {
        val request = PeriodicWorkRequestBuilder<StepSyncWorker>(
            1, TimeUnit.HOURS,
            15, TimeUnit.MINUTES
        )
            .setConstraints(networkConstraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    /** Uploads pending totals as soon as there is a network connection. */
    fun syncNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<StepSyncWorker>()
            .setConstraints(networkConstraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()

        // APPEND_OR_REPLACE: a sync requested while one runs is not lost.
        WorkManager.getInstance(context).enqueueUniqueWork(
            UNIQUE_ONE_TIME_WORK_NAME,
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request
        )
    }

    fun cancelAll(context: Context) {
        val workManager = WorkManager.getInstance(context)
        workManager.cancelUniqueWork(UNIQUE_PERIODIC_WORK_NAME)
        workManager.cancelUniqueWork(UNIQUE_ONE_TIME_WORK_NAME)
    }
}
