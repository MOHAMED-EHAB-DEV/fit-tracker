package com.fittracker

import android.app.Application
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.fittracker.notification.PlannerNotificationManager
import com.fittracker.steps.StepStore
import com.fittracker.widget.WidgetDataStore

class FitTrackerApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Removes the old stored bearer token and the undated widget numbers.
        StepStore.migrate(this)
        WidgetDataStore.migrate(this)
        PlannerNotificationManager.createNotificationChannel(this)

        // While the process is alive, save the latest step state before a shutdown.
        ContextCompat.registerReceiver(
            this,
            SystemEventsReceiver(),
            IntentFilter(Intent.ACTION_SHUTDOWN),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }
}
