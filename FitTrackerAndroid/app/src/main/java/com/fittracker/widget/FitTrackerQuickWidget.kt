package com.fittracker.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

/** Quick step counter (2x2). Renders stored data only; it never claims a sync that did not happen. */
class FitTrackerQuickWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        FitTrackerWidgetUpdater.updateSmallWidgets(context, appWidgetManager, appWidgetIds)
    }
}
