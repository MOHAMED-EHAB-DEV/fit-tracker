package com.fittracker.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.fittracker.notification.PlannerNotificationManager
import com.fittracker.steps.StepStore

/** Fires one scheduled planner reminder (explicit intents from AlarmManager only). */
class ReminderReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ReminderReceiver"
        /** Reminders delivered this late after the event started are dropped. */
        private const val STALE_AFTER_START_MS = 30L * 60 * 1000
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ReminderScheduler.ACTION_FIRE) return
        val key = intent.data?.lastPathSegment ?: return
        val reminder = ReminderScheduler.find(context, key)
        if (reminder == null) {
            Log.d(TAG, "Reminder $key is no longer scheduled")
            return
        }
        ReminderScheduler.markFired(context, key)
        if (StepStore.isSignedOut(context)) return
        if (System.currentTimeMillis() > reminder.startsAtMs + STALE_AFTER_START_MS) {
            Log.d(TAG, "Reminder $key arrived too late; skipped")
            return
        }
        PlannerNotificationManager.showReminder(context, reminder, StepStore.getTimeZone(context))
    }
}
