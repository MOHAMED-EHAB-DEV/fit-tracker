package com.fittracker.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.text.format.DateFormat
import android.util.Log
import android.widget.RemoteViews
import com.fittracker.MainActivity
import com.fittracker.R
import com.fittracker.SystemEventsReceiver
import com.fittracker.steps.DayMath
import com.fittracker.steps.StepReadService
import com.fittracker.steps.StepSensorManager
import com.fittracker.steps.StepStore
import java.util.Date
import java.util.Locale

object FitTrackerWidgetUpdater {

    private const val TAG = "FitTrackerWidgetUpdater"
    private const val REQUEST_DAY_ROLLOVER = 9001
    /** Live sensor updates refresh widgets at most this often. */
    private const val THROTTLE_MS = 30_000L

    @Volatile private var lastThrottledUpdate = 0L

    private const val IMMUTABLE_FLAGS = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    private fun launchAppIntent(context: Context, requestCode: Int, requestStepPermission: Boolean = false): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = if (requestStepPermission) MainActivity.ACTION_ENABLE_STEPS else Intent.ACTION_MAIN
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return PendingIntent.getActivity(context, requestCode, intent, IMMUTABLE_FLAGS)
    }

    /**
     * Sync button: reads the step counter through a short foreground service.
     * Opens the app instead when the user must sign in or allow step access first.
     */
    private fun syncIntent(context: Context, requestCode: Int, data: WidgetFitnessData): PendingIntent {
        if (data.signedOut) return launchAppIntent(context, requestCode)
        if (!StepSensorManager.isSupported(context)) return launchAppIntent(context, requestCode)
        if (!StepSensorManager.hasActivityPermission(context)) {
            return launchAppIntent(context, requestCode, requestStepPermission = true)
        }
        val intent = Intent(context, StepReadService::class.java)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(context, requestCode, intent, IMMUTABLE_FLAGS)
        } else {
            PendingIntent.getService(context, requestCode, intent, IMMUTABLE_FLAGS)
        }
    }

    private fun statusLabel(data: WidgetFitnessData): String = if (data.signedOut) "SIGNED OUT" else "TODAY"

    private fun syncedLabel(context: Context, data: WidgetFitnessData): String {
        if (data.signedOut) return "Open the app to sign in"
        if (data.lastSyncedAt <= 0L) return "Not synced yet"
        val minutes = (System.currentTimeMillis() - data.lastSyncedAt) / 60_000L
        return when {
            minutes < 1 -> "Synced just now"
            minutes < 60 -> "Synced ${minutes}m ago"
            else -> "Synced " + DateFormat.getTimeFormat(context).format(Date(data.lastSyncedAt))
        }
    }

    fun updateMediumWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = launchAppIntent(context, 101)
        val syncIntent = syncIntent(context, 102, data)
        val updatedText = syncedLabel(context, data)

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_step_medium)
            views.setTextViewText(R.id.tv_widget_status, statusLabel(data))
            views.setTextViewText(R.id.tv_widget_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_widget_percent, "${data.stepPercent}%")
            views.setProgressBar(R.id.progress_widget_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_widget_goal_text, data.formattedStepGoalText)
            views.setTextViewText(R.id.tv_widget_last_updated, updatedText)
            views.setTextViewText(R.id.tv_widget_distance, data.formattedDistance)
            views.setTextViewText(R.id.tv_widget_calories, data.formattedStepCalories)
            views.setOnClickPendingIntent(R.id.widget_step_medium_root, launchIntent)
            views.setOnClickPendingIntent(R.id.btn_widget_sync, syncIntent)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    fun updateSmallWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = launchAppIntent(context, 201)
        val goalShort = if (data.stepGoal >= 1000) "${data.stepGoal / 1000}k" else "${data.stepGoal}"
        val percentText = if (data.signedOut) "Sign in" else "${data.stepPercent}% of $goalShort"

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_step_small)
            views.setTextViewText(R.id.tv_widget_small_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_widget_small_percent, percentText)
            views.setProgressBar(R.id.progress_widget_small_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_widget_small_distance, data.formattedDistance)
            views.setOnClickPendingIntent(R.id.widget_step_small_root, launchIntent)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    fun updateLargeWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = launchAppIntent(context, 301)
        val syncIntent = syncIntent(context, 302, data)
        val updatedText = syncedLabel(context, data)
        val streakText = when (val streak = data.streakDays) {
            null -> "Streak —"
            0 -> "No streak"
            else -> "${streak}d Streak"
        }

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_fitness_large)
            views.setTextViewText(R.id.tv_large_status, statusLabel(data))
            views.setTextViewText(R.id.tv_large_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_large_step_percent, "${data.stepPercent}%")
            views.setProgressBar(R.id.progress_large_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_large_distance, data.formattedDistance)
            views.setTextViewText(R.id.tv_large_step_calories, "${data.stepCalories} kcal burned")
            views.setTextViewText(R.id.tv_large_step_goal, String.format(Locale.US, "Goal: %,d", data.stepGoal))
            views.setTextViewText(R.id.tv_large_calories_in, data.formattedCaloriesIn)
            views.setTextViewText(R.id.tv_large_calories_target, data.formattedTargetCalories)
            views.setProgressBar(R.id.progress_large_calories, 100, data.caloriePercent, false)
            views.setTextViewText(R.id.tv_large_water_ml, data.formattedWaterMl)
            views.setTextViewText(R.id.tv_large_water_target, data.formattedWaterGoal)
            views.setProgressBar(R.id.progress_large_water, 100, data.waterPercent, false)
            views.setTextViewText(R.id.tv_large_streak, streakText)
            views.setTextViewText(R.id.tv_large_updated_at, "FitTracker • $updatedText")
            views.setOnClickPendingIntent(R.id.widget_fitness_large_root, launchIntent)
            views.setOnClickPendingIntent(R.id.btn_widget_large_sync, syncIntent)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    /** Refreshes every placed widget and schedules the next midnight refresh. */
    fun updateAllWidgets(context: Context) {
        try {
            val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
            val mediumIds = appWidgetManager.getAppWidgetIds(ComponentName(context, FitTrackerStepWidget::class.java))
            val smallIds = appWidgetManager.getAppWidgetIds(ComponentName(context, FitTrackerQuickWidget::class.java))
            val largeIds = appWidgetManager.getAppWidgetIds(ComponentName(context, FitTrackerFitnessWidget::class.java))
            if (mediumIds.isNotEmpty()) updateMediumWidgets(context, appWidgetManager, mediumIds)
            if (smallIds.isNotEmpty()) updateSmallWidgets(context, appWidgetManager, smallIds)
            if (largeIds.isNotEmpty()) updateLargeWidgets(context, appWidgetManager, largeIds)
            if (mediumIds.isNotEmpty() || smallIds.isNotEmpty() || largeIds.isNotEmpty()) {
                scheduleDayRollover(context)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update widgets: ${e.message}")
        }
    }

    /** For frequent callers (live step events): updates at most every 30 seconds. */
    fun updateAllWidgetsThrottled(context: Context) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastThrottledUpdate < THROTTLE_MS) return
        lastThrottledUpdate = now
        updateAllWidgets(context)
    }

    /**
     * Widgets must switch to a new day at the user's midnight (DATE_CHANGED is not
     * delivered to apps in the background). A non-waking alarm refreshes them the
     * next time the phone is awake after midnight.
     */
    private fun scheduleDayRollover(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val nextMidnight = DayMath.startOfNextDay(System.currentTimeMillis(), StepStore.getTimeZone(context))
        val intent = Intent(context, SystemEventsReceiver::class.java).apply {
            action = SystemEventsReceiver.ACTION_DAY_ROLLOVER
        }
        val pending = PendingIntent.getBroadcast(context, REQUEST_DAY_ROLLOVER, intent, IMMUTABLE_FLAGS)
        alarmManager.set(AlarmManager.RTC, nextMidnight + 1_000L, pending)
    }
}
