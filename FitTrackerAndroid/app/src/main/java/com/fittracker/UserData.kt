package com.fittracker

import android.content.Context
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.fittracker.reminders.ReminderScheduler
import com.fittracker.reminders.ReminderSyncWorker
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import com.fittracker.widget.FitTrackerWidgetUpdater
import com.fittracker.widget.WidgetDataStore

/** Session lifecycle of the native side (all per-user state lives behind these calls). */
object UserData {
    private const val TAG = "UserData"

    /** The web app reported a signed-in user (with their time zone). */
    fun onSignedIn(context: Context) {
        val wasSignedOut = StepStore.isSignedOut(context)
        StepStore.setSignedOut(context, false)
        WidgetDataStore.setSignedOut(context, false)
        StepSyncScheduler.schedulePeriodicSync(context)
        ReminderSyncWorker.schedulePeriodic(context)
        if (wasSignedOut) {
            ReminderSyncWorker.syncNow(context)
            StepSyncScheduler.syncNow(context)
        }
        FitTrackerWidgetUpdater.updateAllWidgets(context)
    }

    /** The server rejected the session (expired or revoked): stop background work. */
    fun onSessionLost(context: Context) {
        Log.w(TAG, "Session lost; background sync stopped until the user signs in again")
        StepStore.setSignedOut(context, true)
        WidgetDataStore.setSignedOut(context, true)
        StepSyncScheduler.cancelAll(context)
        ReminderSyncWorker.cancelAll(context)
        ReminderScheduler.clearAll(context)
        FitTrackerWidgetUpdater.updateAllWidgets(context)
    }

    /** Logout or account switch: forget everything about this user. */
    fun clearAll(context: Context) {
        StepSyncScheduler.cancelAll(context)
        ReminderSyncWorker.cancelAll(context)
        ReminderScheduler.clearAll(context)
        StepStore.clear(context)
        WidgetDataStore.clear(context)
        try {
            NotificationManagerCompat.from(context).cancelAll()
        } catch (_: Exception) {
        }
        StepRepository.refresh(context)
        FitTrackerWidgetUpdater.updateAllWidgets(context)
    }
}
