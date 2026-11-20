package com.fittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/** Activity & Steps (4x2). Renders stored data only; it never claims a sync that did not happen. */
class FitTrackerStepWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        FitTrackerWidgetUpdater.updateMediumWidgets(context, appWidgetManager, appWidgetIds)
    }
}
