package com.fittracker.steps

import android.content.Context
import android.content.SharedPreferences
import com.fittracker.AppConfig
import org.json.JSONArray
import org.json.JSONObject
import java.util.TimeZone

/**
 * Persistent step-counter state.
 *
 * Every reading is stored with the boot it came from (Settings.Global.BOOT_COUNT),
 * its sensor timestamp and its wall-clock time; step totals are kept per
 * calendar day in the user's time zone, together with the set of days whose
 * latest total has not been uploaded yet.
 */
data class StepState(
    /** BOOT_COUNT of the boot the last reading came from, -1 if unknown. */
    val bootCount: Int = -1,
    /** Wall-clock time of that boot (fallback reboot detection). */
    val bootWallMs: Long = 0L,
    /** Last raw TYPE_STEP_COUNTER value, -1 before the first reading. */
    val lastCounter: Long = -1L,
    /** Sensor timestamp (elapsed-realtime nanos) of the last reading. */
    val lastElapsedNs: Long = 0L,
    /** Wall-clock time of the last reading. */
    val lastWallMs: Long = 0L,
    /** Steps per local day ("YYYY-MM-DD"). */
    val days: Map<String, Long> = emptyMap(),
    /** Days whose current total still has to be uploaded. */
    val pending: Set<String> = emptySet()
)

object StepStore {
    private const val PREFS_NAME = "fit_tracker_steps_prefs"
    private const val KEY_STATE = "step_state_v2"
    private const val KEY_TIME_ZONE = "user_time_zone"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_LAST_SYNC_TS = "last_sync_timestamp"
    private const val KEY_SIGNED_OUT = "signed_out"
    private const val KEY_MIGRATED = "migrated_v2"

    // Legacy keys (version 2.0.0 and earlier).
    private const val LEGACY_DATE = "last_date"
    private const val LEGACY_BASE_SENSOR = "base_sensor_value"
    private const val LEGACY_LAST_SENSOR = "last_sensor_value"
    private const val LEGACY_TODAY_STEPS = "today_steps"
    private const val LEGACY_AUTH_TOKEN = "auth_token"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * One-time cleanup of the old format. The old bearer token is deleted (the
     * app authenticates with the WebView session cookie only). The old baseline
     * is dropped so the next reading starts a fresh one instead of guessing.
     */
    fun migrate(context: Context) {
        val p = prefs(context)
        if (p.getBoolean(KEY_MIGRATED, false)) return
        val editor = p.edit()
        val legacyDate = p.getString(LEGACY_DATE, null)
        val legacySteps = p.getLong(LEGACY_TODAY_STEPS, -1L)
        if (!p.contains(KEY_STATE) && DayMath.isValidDateString(legacyDate) && legacySteps > 0) {
            val seeded = StepState(days = mapOf(legacyDate!! to legacySteps))
            editor.putString(KEY_STATE, encode(seeded))
        }
        editor.remove(LEGACY_AUTH_TOKEN)
            .remove(LEGACY_DATE)
            .remove(LEGACY_BASE_SENSOR)
            .remove(LEGACY_LAST_SENSOR)
            .remove(LEGACY_TODAY_STEPS)
            .putBoolean(KEY_MIGRATED, true)
            .commit()
    }

    fun load(context: Context): StepState = decode(prefs(context).getString(KEY_STATE, null))

    fun save(context: Context, state: StepState, synchronous: Boolean = false) {
        val editor = prefs(context).edit().putString(KEY_STATE, encode(state))
        if (synchronous) editor.commit() else editor.apply()
    }

    // ---- user context -------------------------------------------------------

    fun getTimeZoneId(context: Context): String {
        val stored = prefs(context).getString(KEY_TIME_ZONE, null)
        return if (DayMath.isValidZoneId(stored)) stored!! else TimeZone.getDefault().id
    }

    fun getTimeZone(context: Context): TimeZone = DayMath.zone(getTimeZoneId(context))

    /** Returns true when the zone was valid and stored. */
    fun setTimeZoneId(context: Context, zoneId: String): Boolean {
        if (!DayMath.isValidZoneId(zoneId)) return false
        prefs(context).edit().putString(KEY_TIME_ZONE, zoneId).apply()
        return true
    }

    fun todayDateString(context: Context, nowMs: Long = System.currentTimeMillis()): String =
        DayMath.dateString(nowMs, getTimeZone(context))

    /** Origin for background requests; always one of AppConfig.allowedOrigins. */
    fun getServerUrl(context: Context): String {
        val stored = prefs(context).getString(KEY_SERVER_URL, null)
        return if (AppConfig.isAllowedOrigin(stored)) stored!! else AppConfig.APP_ORIGIN
    }

    fun setServerUrl(context: Context, origin: String): Boolean {
        val normalized = AppConfig.normalizeOrigin(origin) ?: return false
        if (!AppConfig.isAllowedOrigin(normalized)) return false
        prefs(context).edit().putString(KEY_SERVER_URL, normalized).apply()
        return true
    }

    fun isSignedOut(context: Context): Boolean = prefs(context).getBoolean(KEY_SIGNED_OUT, true)

    fun setSignedOut(context: Context, signedOut: Boolean) {
        prefs(context).edit().putBoolean(KEY_SIGNED_OUT, signedOut).apply()
    }

    fun recordSuccessfulSync(context: Context) {
        prefs(context).edit().putLong(KEY_LAST_SYNC_TS, System.currentTimeMillis()).apply()
    }

    fun getLastSyncTimestamp(context: Context): Long = prefs(context).getLong(KEY_LAST_SYNC_TS, 0L)

    /** Forgets everything about the signed-in user (logout or account switch). */
    fun clear(context: Context) {
        prefs(context).edit()
            .remove(KEY_STATE)
            .remove(KEY_LAST_SYNC_TS)
            .remove(KEY_TIME_ZONE)
            .remove(LEGACY_AUTH_TOKEN)
            .putBoolean(KEY_SIGNED_OUT, true)
            .commit()
    }

    // ---- encoding -----------------------------------------------------------

    private fun encode(state: StepState): String {
        val days = JSONObject()
        state.days.forEach { (date, steps) -> days.put(date, steps) }
        val pending = JSONArray()
        state.pending.sorted().forEach { pending.put(it) }
        return JSONObject()
            .put("bootCount", state.bootCount)
            .put("bootWallMs", state.bootWallMs)
            .put("lastCounter", state.lastCounter)
            .put("lastElapsedNs", state.lastElapsedNs)
            .put("lastWallMs", state.lastWallMs)
            .put("days", days)
            .put("pending", pending)
            .toString()
    }

    private fun decode(raw: String?): StepState {
        if (raw.isNullOrBlank()) return StepState()
        return try {
            val json = JSONObject(raw)
            val days = LinkedHashMap<String, Long>()
            json.optJSONObject("days")?.let { obj ->
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = obj.optLong(key, -1L)
                    if (DayMath.isValidDateString(key) && value >= 0) days[key] = value
                }
            }
            val pending = HashSet<String>()
            json.optJSONArray("pending")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val date = arr.optString(i, "")
                    if (DayMath.isValidDateString(date)) pending.add(date)
                }
            }
            StepState(
                bootCount = json.optInt("bootCount", -1),
                bootWallMs = json.optLong("bootWallMs", 0L),
                lastCounter = json.optLong("lastCounter", -1L),
                lastElapsedNs = json.optLong("lastElapsedNs", 0L),
                lastWallMs = json.optLong("lastWallMs", 0L),
                days = days,
                pending = pending
            )
        } catch (_: Exception) {
            StepState()
        }
    }
}
