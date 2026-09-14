package com.fittracker.notification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.fittracker.MainActivity
import com.fittracker.R

object PlannerNotificationManager {
    private const val TAG = "PlannerNotifManager"
    const val CHANNEL_ID = "fittracker_planner_channel"

    /**
     * Initializes the high-importance notification channel.
     * Configured for heads-up banners visible across lock screen and active apps.
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Day Planner"
            val descriptionText = "Notifications for scheduled events"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                lightColor = Color.parseColor("#10B981")
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 150, 250)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(true)
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Displays a heads-up system notification for an event.
     */
    fun showNotification(
        context: Context,
        eventId: String,
        title: String,
        description: String,
        category: String? = null
    ) {
        createNotificationChannel(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("route", "/planner")
        }

        val contentPendingIntent = PendingIntent.getActivity(
            context,
            eventId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val categoryPrefix = when (category?.lowercase()) {
            "workout" -> "🏋️ Workout: "
            "nutrition" -> "🥗 Meal: "
            "habit" -> "⚡ Habit: "
            "recovery" -> "🧘 Recovery: "
            "focus" -> "🎯 Focus: "
            else -> "⏰ "
        }

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("$categoryPrefix$title")
            .setContentText(description.ifBlank { "Scheduled event" })
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(
                    description.ifBlank { "Scheduled in your FitTracker Day Planner" }
                )
            )
            .setColor(Color.parseColor("#10B981"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(defaultSoundUri)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(eventId.hashCode(), notification)
            Log.d(TAG, "Displayed notification for event: $eventId ($title)")
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing notification permission: ${e.localizedMessage}")
        }
    }
}
