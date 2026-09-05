package com.fittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.util.Log
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepSensorManager
import com.fittracker.steps.StepSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FitTrackerStepWidget : AppWidgetProvider() {

    companion object {
        private const val TAG = "FitTrackerStepWidget"
        const val ACTION_SYNC_WIDGET = "com.fittracker.widget.ACTION_SYNC_WIDGET"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        // Refresh cached step count
        val cachedSteps = StepRepository.getCachedTodaySteps(context)
        WidgetDataStore.updateSteps(context, cachedSteps)
        FitTrackerWidgetUpdater.updateMediumWidgets(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_SYNC_WIDGET -> {
                Log.d(TAG, "Interactive widget sync requested from home screen.")
                // Launch battery-safe one-shot sensor read without blocking main thread
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val reading = StepSensorManager.readCurrentCount(context, timeoutMs = 1500L)
                        val todaySteps = if (reading != null) {
                            StepRepository.processNewSensorReading(context, reading)
                        } else {
                            StepRepository.getCachedTodaySteps(context)
                        }

                        WidgetDataStore.updateSteps(context, todaySteps)
                        FitTrackerWidgetUpdater.updateAllWidgets(context)

                        // Trigger low-power background network sync with backend
                        StepSyncScheduler.syncNow(context)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error during widget sensor sync: ${e.localizedMessage}")
                    }
                }
            }
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_BOOT_COMPLETED -> {
                val cachedSteps = StepRepository.getCachedTodaySteps(context)
                WidgetDataStore.updateSteps(context, cachedSteps)
                FitTrackerWidgetUpdater.updateAllWidgets(context)
            }
        }
    }
}
