package com.fittracker.steps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.fittracker.R
import com.fittracker.widget.FitTrackerWidgetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * A few-second foreground service (type "health") started by a widget's Sync
 * button. Android only delivers step-counter events to foreground apps, so
 * this is what lets the widget read the real count while the app is closed.
 * It reads once, queues the upload and stops.
 */
class StepReadService : Service() {

    companion object {
        private const val TAG = "StepReadService"
        private const val CHANNEL_ID = "fittracker_step_sync"
        private const val NOTIFICATION_ID = 4101
        private const val READ_TIMEOUT_MS = 4000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    @Volatile private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // A service started with startForegroundService() must always enter the foreground.
        val canRead = StepSensorManager.hasActivityPermission(this) && StepSensorManager.isSupported(this)
        val inForeground = enterForeground(canRead)
        if (!canRead || !inForeground) {
            FitTrackerWidgetUpdater.updateAllWidgets(this)
            if (inForeground) stopForegroundCompat()
            stopSelf(startId)
            return START_NOT_STICKY
        }
        if (running) return START_NOT_STICKY
        running = true

        scope.launch {
            try {
                StepRepository.readAndProcess(applicationContext, READ_TIMEOUT_MS)
                StepSyncScheduler.syncNow(applicationContext)
            } catch (e: Exception) {
                Log.e(TAG, "Widget step read failed: ${e.message}")
            } finally {
                FitTrackerWidgetUpdater.updateAllWidgets(applicationContext)
                running = false
                stopForegroundCompat()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    /**
     * Android 14+: type "health" needs the activity-recognition permission; without it
     * the service briefly enters the foreground as a "short service" and stops.
     */
    private fun enterForeground(canRead: Boolean): Boolean {
        val notification = buildNotification()
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val type = if (canRead) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
                } else {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE
                }
                startForeground(NOTIFICATION_ID, notification, type)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            true
        } catch (e: Exception) {
            // SecurityException / ForegroundServiceStartNotAllowedException.
            Log.w(TAG, "Could not start the step reader: ${e.message}")
            false
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.channel_steps_name),
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = getString(R.string.channel_steps_desc)
                    setShowBadge(false)
                }
                manager.createNotificationChannel(channel)
            }
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_fittracker)
            .setContentTitle(getString(R.string.notification_steps_reading))
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
