package com.fittracker.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import com.fittracker.MainActivity
import com.fittracker.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object FitTrackerWidgetUpdater {

    private fun getPendingIntentFlags(isMutable: Boolean = false): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (isMutable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            }
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
    }

    /**
     * Creates an Intent to launch MainActivity when widget body is tapped.
     */
    private fun createLaunchAppPendingIntent(context: Context, requestCode: Int): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("source", "widget")
        }
        return PendingIntent.getActivity(context, requestCode, intent, getPendingIntentFlags())
    }

    /**
     * Creates a broadcast PendingIntent for the interactive Sync button.
     */
    private fun createSyncPendingIntent(context: Context, requestCode: Int): PendingIntent {
        val intent = Intent(FitTrackerStepWidget.ACTION_SYNC_WIDGET).apply {
            component = ComponentName(context, FitTrackerStepWidget::class.java)
        }
        return PendingIntent.getBroadcast(context, requestCode, intent, getPendingIntentFlags())
    }

    /**
     * Formats timestamp into compact relative or short time string (e.g. "Synced 10:45 AM").
     */
    private fun formatUpdatedTime(timestamp: Long): String {
        if (timestamp <= 0L) return "Live sensor"
        val diff = System.currentTimeMillis() - timestamp
        val minutes = diff / (1000 * 60)
        return when {
            minutes < 1 -> "Synced just now"
            minutes < 60 -> "Synced ${minutes}m ago"
            else -> {
                val sdf = SimpleDateFormat("h:mm a", Locale.US)
                "Synced " + sdf.format(Date(timestamp))
            }
        }
    }

    /**
     * Updates all active Medium (4x2) widgets.
     */
    fun updateMediumWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = createLaunchAppPendingIntent(context, 101)
        val syncIntent = createSyncPendingIntent(context, 102)
        val updatedText = formatUpdatedTime(data.lastUpdateTimestamp)

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_step_medium)

            // Step metrics
            views.setTextViewText(R.id.tv_widget_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_widget_percent, "${data.stepPercent}%")
            views.setProgressBar(R.id.progress_widget_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_widget_goal_text, data.formattedStepGoalText)
            views.setTextViewText(R.id.tv_widget_last_updated, updatedText)

            // Chips
            views.setTextViewText(R.id.tv_widget_distance, data.formattedDistance)
            views.setTextViewText(R.id.tv_widget_calories, data.formattedStepCalories)

            // Click Handlers
            views.setOnClickPendingIntent(R.id.widget_step_medium_root, launchIntent)
            views.setOnClickPendingIntent(R.id.btn_widget_sync, syncIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    /**
     * Updates all active Small (2x2) widgets.
     */
    fun updateSmallWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = createLaunchAppPendingIntent(context, 201)

        val goalShort = if (data.stepGoal >= 1000) "${data.stepGoal / 1000}k" else "${data.stepGoal}"

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_step_small)

            views.setTextViewText(R.id.tv_widget_small_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_widget_small_percent, "${data.stepPercent}% of $goalShort")
            views.setProgressBar(R.id.progress_widget_small_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_widget_small_distance, data.formattedDistance)

            views.setOnClickPendingIntent(R.id.widget_step_small_root, launchIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    /**
     * Updates all active Large (4x3) Daily Fitness Overview widgets.
     */
    fun updateLargeWidgets(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val data = WidgetDataStore.getData(context)
        val launchIntent = createLaunchAppPendingIntent(context, 301)
        val syncIntent = createSyncPendingIntent(context, 302)
        val updatedText = formatUpdatedTime(data.lastUpdateTimestamp)

        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_fitness_large)

            // Steps section
            views.setTextViewText(R.id.tv_large_steps, data.formattedSteps)
            views.setTextViewText(R.id.tv_large_step_percent, "${data.stepPercent}%")
            views.setProgressBar(R.id.progress_large_steps, 100, data.stepPercent, false)
            views.setTextViewText(R.id.tv_large_distance, data.formattedDistance)
            views.setTextViewText(R.id.tv_large_step_calories, "${data.stepCalories} kcal burned")
            views.setTextViewText(R.id.tv_large_step_goal, String.format(Locale.US, "Goal: %,d", data.stepGoal))

            // Calories section
            views.setTextViewText(R.id.tv_large_calories_in, data.formattedCaloriesIn)
            views.setTextViewText(R.id.tv_large_calories_target, data.formattedTargetCalories)
            views.setProgressBar(R.id.progress_large_calories, 100, data.caloriePercent, false)

            // Water section
            views.setTextViewText(R.id.tv_large_water_ml, data.formattedWaterMl)
            views.setTextViewText(R.id.tv_large_water_target, data.formattedWaterGoal)
            views.setProgressBar(R.id.progress_large_water, 100, data.waterPercent, false)

            // Habit Streak
            val streakText = if (data.streakDays > 0) "${data.streakDays}d Streak" else "No Streak"
            views.setTextViewText(R.id.tv_large_streak, streakText)

            // Footer
            views.setTextViewText(R.id.tv_large_updated_at, "FitTracker • $updatedText")

            // Click Handlers
            views.setOnClickPendingIntent(R.id.widget_fitness_large_root, launchIntent)
            views.setOnClickPendingIntent(R.id.btn_widget_large_sync, syncIntent)

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    /**
     * Refreshes all active widgets of all types across the Android system.
     */
    fun updateAllWidgets(context: Context) {
        try {
            val appWidgetManager = AppWidgetManager.getInstance(context)

            // Medium widgets
            val mediumIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, FitTrackerStepWidget::class.java)
            )
            if (mediumIds.isNotEmpty()) {
                updateMediumWidgets(context, appWidgetManager, mediumIds)
            }

            // Small widgets
            val smallIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, FitTrackerQuickWidget::class.java)
            )
            if (smallIds.isNotEmpty()) {
                updateSmallWidgets(context, appWidgetManager, smallIds)
            }

            // Large widgets
            val largeIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, FitTrackerFitnessWidget::class.java)
            )
            if (largeIds.isNotEmpty()) {
                updateLargeWidgets(context, appWidgetManager, largeIds)
            }
        } catch (e: Exception) {
            android.util.Log.e("FitTrackerWidgetUpdater", "Failed to update widgets: ${e.localizedMessage}")
        }
    }
}
