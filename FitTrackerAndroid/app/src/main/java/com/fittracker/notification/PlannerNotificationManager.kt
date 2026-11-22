package com.fittracker.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.fittracker.MainActivity
import com.fittracker.R
import com.fittracker.reminders.Reminder
import java.util.Date
import java.util.TimeZone

object PlannerNotificationManager {
    private const val TAG = "PlannerNotifManager"
    /** v2: private on the lock screen (channel visibility cannot be changed after creation). */
    const val CHANNEL_ID = "fittracker_planner_reminders_v2"
    private const val LEGACY_CHANNEL_ID = "fittracker_planner_channel"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.channel_planner_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.channel_planner_desc)
            enableLights(true)
            lightColor = Color.parseColor("#4C82FB")
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 150, 250)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    private fun openPlannerIntent(context: Context, requestCode: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = MainActivity.ACTION_OPEN_ROUTE
            putExtra(MainActivity.EXTRA_ROUTE, "/planner")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun categoryPrefix(category: String?): String = when (category?.lowercase()) {
        "workout" -> "🏋️ "
        "nutrition" -> "🥗 "
        "habit" -> "⚡ "
        "recovery" -> "🧘 "
        "focus" -> "🎯 "
        else -> "⏰ "
    }

    private fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun post(context: Context, id: Int, title: String, text: String, requestCode: Int) {
        if (!canPost(context)) {
            Log.w(TAG, "Notifications are not allowed; reminder not shown")
            return
        }
        createNotificationChannel(context)

        // What the lock screen shows instead of the event details.
        val publicVersion = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_fittracker)
            .setContentTitle(context.getString(R.string.notification_private_title))
            .setContentText(context.getString(R.string.notification_private_text))
            .build()

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_fittracker)
            .setColor(Color.parseColor("#4C82FB"))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(openPlannerIntent(context, requestCode))
            .build()

        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing notification permission: ${e.message}")
        }
    }

    /** A scheduled reminder: "<title>" / "Starts at 18:00 · <description>". */
    fun showReminder(context: Context, reminder: Reminder, userZone: TimeZone) {
        val timeFormat = android.text.format.DateFormat.getTimeFormat(context)
        timeFormat.timeZone = userZone
        val startsAt = timeFormat.format(Date(reminder.startsAtMs))
        val text = buildString {
            append("Starts at ").append(startsAt)
            if (reminder.description.isNotBlank()) append(" · ").append(reminder.description)
        }
        val id = reminder.key.hashCode()
        post(context, id, categoryPrefix(reminder.category) + reminder.title, text, id)
    }

    /** An immediate notification requested by the planner page. Inputs are already validated. */
    fun showNotification(context: Context, eventId: String, title: String, description: String, category: String?) {
        val id = eventId.hashCode()
        post(
            context,
            id,
            categoryPrefix(category) + title,
            description.ifBlank { "Scheduled in your FitTracker planner" },
            id
        )
    }
}
