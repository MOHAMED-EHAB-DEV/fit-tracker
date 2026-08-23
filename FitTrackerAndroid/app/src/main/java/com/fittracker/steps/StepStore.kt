package com.fittracker.steps

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class StepState(
    val lastDateString: String,
    val baseSensorValue: Long,
    val lastSensorValue: Long,
    val todaySteps: Long
)

object StepStore {
    private const val PREFS_NAME = "fit_tracker_steps_prefs"
    private const val KEY_DATE = "last_date"
    private const val KEY_BASE_SENSOR = "base_sensor_value"
    private const val KEY_LAST_SENSOR = "last_sensor_value"
    private const val KEY_TODAY_STEPS = "today_steps"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_LAST_SYNC_TS = "last_sync_timestamp"

    // Default development fallback URL (Android emulator loopback)
    const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Formats current date as "yyyy-MM-dd". Defaults to Cairo timezone to match backend.
     */
    fun getTodayDateString(timeZoneId: String = "Africa/Cairo"): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        try {
            sdf.timeZone = TimeZone.getTimeZone(timeZoneId)
        } catch (_: Exception) {
            sdf.timeZone = TimeZone.getDefault()
        }
        return sdf.format(Date())
    }

    fun load(context: Context): StepState {
        val prefs = getPrefs(context)
        return StepState(
            lastDateString = prefs.getString(KEY_DATE, "") ?: "",
            baseSensorValue = prefs.getLong(KEY_BASE_SENSOR, -1L),
            lastSensorValue = prefs.getLong(KEY_LAST_SENSOR, -1L),
            todaySteps = prefs.getLong(KEY_TODAY_STEPS, 0L)
        )
    }

    fun save(context: Context, state: StepState) {
        getPrefs(context).edit()
            .putString(KEY_DATE, state.lastDateString)
            .putLong(KEY_BASE_SENSOR, state.baseSensorValue)
            .putLong(KEY_LAST_SENSOR, state.lastSensorValue)
            .putLong(KEY_TODAY_STEPS, state.todaySteps)
            .apply()
    }

    fun getServerUrl(context: Context): String {
        val url = getPrefs(context).getString(KEY_SERVER_URL, null)
        return if (!url.isNullOrBlank()) url else DEFAULT_SERVER_URL
    }

    fun setServerUrl(context: Context, url: String) {
        if (url.isNotBlank()) {
            val sanitized = url.trim().removeSuffix("/")
            getPrefs(context).edit().putString(KEY_SERVER_URL, sanitized).apply()
        }
    }

    fun getAuthToken(context: Context): String? {
        return getPrefs(context).getString(KEY_AUTH_TOKEN, null)
    }

    fun setAuthToken(context: Context, token: String?) {
        getPrefs(context).edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun recordSuccessfulSync(context: Context) {
        getPrefs(context).edit().putLong(KEY_LAST_SYNC_TS, System.currentTimeMillis()).apply()
    }

    fun getLastSyncTimestamp(context: Context): Long {
        return getPrefs(context).getLong(KEY_LAST_SYNC_TS, 0L)
    }
}
