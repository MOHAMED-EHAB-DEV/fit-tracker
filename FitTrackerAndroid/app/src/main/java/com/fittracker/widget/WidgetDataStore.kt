package com.fittracker.widget

import android.content.Context
import android.content.SharedPreferences
import java.util.Locale

data class WidgetFitnessData(
    val steps: Long = 0L,
    val stepGoal: Int = 10000,
    val caloriesIn: Int = 0,
    val targetCalories: Int = 2400,
    val waterMl: Int = 0,
    val waterGoalMl: Int = 3000,
    val lastUpdateTimestamp: Long = 0L
) {
    val distanceKm: Float
        get() = (steps * 0.00075f)

    val stepCalories: Int
        get() = (steps * 0.04f).toInt()

    val stepPercent: Int
        get() = if (stepGoal > 0) {
            ((steps.toFloat() / stepGoal) * 100).toInt().coerceIn(0, 100)
        } else 0

    val caloriePercent: Int
        get() = if (targetCalories > 0) {
            ((caloriesIn.toFloat() / targetCalories) * 100).toInt().coerceIn(0, 100)
        } else 0

    val waterPercent: Int
        get() = if (waterGoalMl > 0) {
            ((waterMl.toFloat() / waterGoalMl) * 100).toInt().coerceIn(0, 100)
        } else 0

    val formattedSteps: String
        get() = String.format(Locale.US, "%,d", steps)

    val formattedDistance: String
        get() = String.format(Locale.US, "%.1f km", distanceKm)

    val formattedStepCalories: String
        get() = String.format(Locale.US, "%d kcal", stepCalories)

    val formattedCaloriesIn: String
        get() = String.format(Locale.US, "%,d", caloriesIn)

    val formattedTargetCalories: String
        get() = String.format(Locale.US, "/ %,d kcal", targetCalories)

    val formattedWaterMl: String
        get() = String.format(Locale.US, "%,d", waterMl)

    val formattedWaterGoal: String
        get() = String.format(Locale.US, "/ %,d ml", waterGoalMl)

    val formattedStepGoalText: String
        get() = String.format(Locale.US, "Goal: %,d steps", stepGoal)
}

object WidgetDataStore {
    private const val PREFS_NAME = "fit_tracker_widget_prefs"

    private const val KEY_STEPS = "widget_steps"
    private const val KEY_STEP_GOAL = "widget_step_goal"
    private const val KEY_CALORIES_IN = "widget_calories_in"
    private const val KEY_TARGET_CALORIES = "widget_target_calories"
    private const val KEY_WATER_ML = "widget_water_ml"
    private const val KEY_WATER_GOAL_ML = "widget_water_goal_ml"
    private const val KEY_LAST_UPDATE = "widget_last_update_ts"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getData(context: Context): WidgetFitnessData {
        val prefs = getPrefs(context)
        return WidgetFitnessData(
            steps = prefs.getLong(KEY_STEPS, 0L),
            stepGoal = prefs.getInt(KEY_STEP_GOAL, 10000),
            caloriesIn = prefs.getInt(KEY_CALORIES_IN, 0),
            targetCalories = prefs.getInt(KEY_TARGET_CALORIES, 2400),
            waterMl = prefs.getInt(KEY_WATER_ML, 0),
            waterGoalMl = prefs.getInt(KEY_WATER_GOAL_ML, 3000),
            lastUpdateTimestamp = prefs.getLong(KEY_LAST_UPDATE, System.currentTimeMillis())
        )
    }

    fun updateSteps(context: Context, steps: Long) {
        getPrefs(context).edit()
            .putLong(KEY_STEPS, steps)
            .putLong(KEY_LAST_UPDATE, System.currentTimeMillis())
            .apply()
    }

    fun updateAllMetrics(
        context: Context,
        steps: Long? = null,
        stepGoal: Int? = null,
        caloriesIn: Int? = null,
        targetCalories: Int? = null,
        waterMl: Int? = null,
        waterGoalMl: Int? = null
    ) {
        val editor = getPrefs(context).edit()
        steps?.let { editor.putLong(KEY_STEPS, it) }
        stepGoal?.let { editor.putInt(KEY_STEP_GOAL, it) }
        caloriesIn?.let { editor.putInt(KEY_CALORIES_IN, it) }
        targetCalories?.let { editor.putInt(KEY_TARGET_CALORIES, it) }
        waterMl?.let { editor.putInt(KEY_WATER_ML, it) }
        waterGoalMl?.let { editor.putInt(KEY_WATER_GOAL_ML, it) }
        editor.putLong(KEY_LAST_UPDATE, System.currentTimeMillis())
        editor.apply()
    }
}
