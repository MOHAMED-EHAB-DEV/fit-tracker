package com.fittracker

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.fittracker.reminders.ReminderScheduler
import com.fittracker.reminders.ReminderSyncWorker
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import com.fittracker.widget.FitTrackerWidgetUpdater

/**
 * System events (not exported): reboot, app update, clock and zone changes,
 * exact-alarm permission changes, shutdown, and the app's own midnight alarm.
 */
class SystemEventsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SystemEventsReceiver"
        const val ACTION_DAY_ROLLOVER = "com.fittracker.action.DAY_ROLLOVER"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SHUTDOWN -> {
                // Persist synchronously; the process is about to die.
                StepRepository.flush(context)
            }
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED -> {
                Log.d(TAG, "Rescheduling after ${intent.action}")
                if (!StepStore.isSignedOut(context)) {
                    ReminderScheduler.rescheduleStored(context)
                    ReminderSyncWorker.schedulePeriodic(context)
                    ReminderSyncWorker.syncNow(context)
                    StepSyncScheduler.schedulePeriodicSync(context)
                }
                StepRepository.refresh(context)
                FitTrackerWidgetUpdater.updateAllWidgets(context)
            }
            ACTION_DAY_ROLLOVER -> {
                StepRepository.refresh(context)
                FitTrackerWidgetUpdater.updateAllWidgets(context)
            }
        }
    }
}
