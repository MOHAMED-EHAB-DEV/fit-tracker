package com.fittracker.widget

import android.content.Context
import android.content.SharedPreferences
import com.fittracker.steps.DayMath
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepStore
import java.util.Locale

/** Everything a widget shows, resolved for the user's current day. */
data class WidgetFitnessData(
    val steps: Long = 0L,
    val stepGoal: Int = DEFAULT_STEP_GOAL,
    /** Null when the dashboard has not reported today's numbers yet. */
    val caloriesIn: Int? = null,
    /** Null until the dashboard reports the user's targets. */
    val targetCalories: Int? = null,
    val waterMl: Int? = null,
    val waterGoalMl: Int? = null,
    val streakDays: Int? = null,
    /** Last confirmed contact with the server (upload or dashboard data), 0 if never. */
    val lastSyncedAt: Long = 0L,
    val signedOut: Boolean = false
) {
    companion object {
        /** The app's default goal (same as the server's) when the user has not set one. */
        const val DEFAULT_STEP_GOAL = 10_000
    }

    val distanceKm: Float get() = steps * 0.00075f
    /** Same formula as the server (lib/fitness/daily-log stepsToCalories). */
    val stepCalories: Int get() = Math.round(steps * 0.04f)

    private fun percent(value: Long, goal: Int?): Int =
        if (goal != null && goal > 0) ((value.toFloat() / goal) * 100).toInt().coerceIn(0, 100) else 0

    val stepPercent: Int get() = percent(steps, stepGoal)
    val caloriePercent: Int get() = percent((caloriesIn ?: 0).toLong(), targetCalories)
    val waterPercent: Int get() = percent((waterMl ?: 0).toLong(), waterGoalMl)

    val formattedSteps: String get() = String.format(Locale.US, "%,d", steps)
    val formattedDistance: String get() = String.format(Locale.US, "%.1f km", distanceKm)
    val formattedStepCalories: String get() = String.format(Locale.US, "%d kcal", stepCalories)
    val formattedCaloriesIn: String get() = caloriesIn?.let { String.format(Locale.US, "%,d", it) } ?: "—"
    val formattedTargetCalories: String
        get() = targetCalories?.let { String.format(Locale.US, "/ %,d kcal", it) } ?: "/ — kcal"
    val formattedWaterMl: String get() = waterMl?.let { String.format(Locale.US, "%,d", it) } ?: "—"
    val formattedWaterGoal: String
        get() = waterGoalMl?.let { String.format(Locale.US, "/ %,d ml", it) } ?: "/ — ml"
    val formattedStepGoalText: String get() = String.format(Locale.US, "Goal: %,d steps", stepGoal)
}

/**
 * Widget data with one writer per source:
 * - the phone's own step total is read from StepStore (written only by StepRepository);
 * - the server's numbers for a day are written only by the web dashboard (updateWidgetData),
 *   stamped with that day and ignored once the day is over.
 */
object WidgetDataStore {
    private const val PREFS_NAME = "fit_tracker_widget_prefs_v2"
    private const val LEGACY_PREFS_NAME = "fit_tracker_widget_prefs"

    private const val KEY_DATE = "web_date"
    private const val KEY_SERVER_STEPS = "server_steps"
    private const val KEY_STEP_GOAL = "step_goal"
    private const val KEY_CALORIES_IN = "calories_in"
    private const val KEY_TARGET_CALORIES = "target_calories"
    private const val KEY_WATER_ML = "water_ml"
    private const val KEY_WATER_GOAL_ML = "water_goal_ml"
    private const val KEY_STREAK_DAYS = "streak_days"
    private const val KEY_STREAK_DATE = "streak_date"
    private const val KEY_WEB_UPDATED_AT = "web_updated_at"
    private const val KEY_SIGNED_OUT = "signed_out"

    /** Fields that describe one day and must not carry over to the next. */
    private val DAY_KEYS = listOf(KEY_SERVER_STEPS, KEY_CALORIES_IN, KEY_WATER_ML)

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun migrate(context: Context) {
        // The old store had no dates, so its numbers cannot be trusted; drop them.
        context.applicationContext.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
            .edit().clear().apply()
    }

    data class WebUpdate(
        val date: String?,
        val serverSteps: Long?,
        val stepGoal: Int?,
        val caloriesIn: Int?,
        val targetCalories: Int?,
        val waterMl: Int?,
        val waterGoalMl: Int?,
        val streakDays: Int?
    )

    /** Stores the dashboard's numbers. A partial update for a new day clears the old day's values. */
    fun applyWebUpdate(context: Context, update: WebUpdate) {
        val today = StepStore.todayDateString(context)
        val date = update.date ?: today
        // Only today's (or a late yesterday's) data is useful; never store another day as today.
        if (date != today) return

        val p = prefs(context)
        val editor = p.edit()
        if (p.getString(KEY_DATE, null) != date) {
            DAY_KEYS.forEach { editor.remove(it) }
            editor.putString(KEY_DATE, date)
        }
        update.serverSteps?.let { editor.putLong(KEY_SERVER_STEPS, it) }
        update.caloriesIn?.let { editor.putInt(KEY_CALORIES_IN, it) }
        update.waterMl?.let { editor.putInt(KEY_WATER_ML, it) }
        update.stepGoal?.let { editor.putInt(KEY_STEP_GOAL, it) }
        update.targetCalories?.let { editor.putInt(KEY_TARGET_CALORIES, it) }
        update.waterGoalMl?.let { editor.putInt(KEY_WATER_GOAL_ML, it) }
        update.streakDays?.let {
            editor.putInt(KEY_STREAK_DAYS, it)
            editor.putString(KEY_STREAK_DATE, date)
        }
        editor.putLong(KEY_WEB_UPDATED_AT, System.currentTimeMillis())
        editor.putBoolean(KEY_SIGNED_OUT, false)
        editor.apply()
    }

    fun setSignedOut(context: Context, signedOut: Boolean) {
        prefs(context).edit().putBoolean(KEY_SIGNED_OUT, signedOut).apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().putBoolean(KEY_SIGNED_OUT, true).commit()
    }

    fun getData(context: Context): WidgetFitnessData {
        val p = prefs(context)
        val today = StepStore.todayDateString(context)
        val isToday = p.getString(KEY_DATE, null) == today
        val signedOut = p.getBoolean(KEY_SIGNED_OUT, true) || StepStore.isSignedOut(context)
        if (signedOut) {
            return WidgetFitnessData(signedOut = true)
        }

        val nativeSteps = StepRepository.getCachedTodaySteps(context)
        val serverSteps = if (isToday) p.getLong(KEY_SERVER_STEPS, 0L) else 0L

        // A streak is still current the day after it was last confirmed.
        val streakDate = p.getString(KEY_STREAK_DATE, null)
        val streakCurrent = streakDate == today || streakDate == DayMath.addDays(today, -1)

        val lastWeb = if (isToday) p.getLong(KEY_WEB_UPDATED_AT, 0L) else 0L
        return WidgetFitnessData(
            steps = maxOf(nativeSteps, serverSteps),
            stepGoal = p.getInt(KEY_STEP_GOAL, WidgetFitnessData.DEFAULT_STEP_GOAL),
            caloriesIn = if (isToday && p.contains(KEY_CALORIES_IN)) p.getInt(KEY_CALORIES_IN, 0) else null,
            targetCalories = if (p.contains(KEY_TARGET_CALORIES)) p.getInt(KEY_TARGET_CALORIES, 0) else null,
            waterMl = if (isToday && p.contains(KEY_WATER_ML)) p.getInt(KEY_WATER_ML, 0) else null,
            waterGoalMl = if (p.contains(KEY_WATER_GOAL_ML)) p.getInt(KEY_WATER_GOAL_ML, 0) else null,
            streakDays = if (streakCurrent && p.contains(KEY_STREAK_DAYS)) p.getInt(KEY_STREAK_DAYS, 0) else null,
            lastSyncedAt = maxOf(StepStore.getLastSyncTimestamp(context), lastWeb),
            signedOut = false
        )
    }
}
