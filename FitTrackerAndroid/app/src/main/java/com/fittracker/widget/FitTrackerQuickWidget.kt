package com.fittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import com.fittracker.steps.StepRepository

class FitTrackerQuickWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        val cachedSteps = StepRepository.getCachedTodaySteps(context)
        WidgetDataStore.updateSteps(context, cachedSteps)
        FitTrackerWidgetUpdater.updateSmallWidgets(context, appWidgetManager, appWidgetIds)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
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
