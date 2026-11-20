package com.fittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/** Daily fitness overview (4x3). Renders stored data only; it never claims a sync that did not happen. */
class FitTrackerFitnessWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        FitTrackerWidgetUpdater.updateLargeWidgets(context, appWidgetManager, appWidgetIds)
    }
}
