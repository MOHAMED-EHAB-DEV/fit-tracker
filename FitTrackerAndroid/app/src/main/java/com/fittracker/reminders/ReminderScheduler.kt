package com.fittracker.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject

/** One scheduled planner reminder. */
data class Reminder(
    /** "<eventId>:<YYYY-MM-DD>" */
    val key: String,
    val eventId: String,
    val title: String,
    val description: String,
    val category: String,
    val startsAtMs: Long,
    val notifyAtMs: Long
)

data class ReminderStatus(
    val ok: Boolean,
    val scheduled: Int,
    val notificationsAllowed: Boolean,
    val exactAlarmsAllowed: Boolean,
    val error: String? = null
) {
    fun toJson(): String = JSONObject()
        .put("ok", ok)
        .put("scheduled", scheduled)
        .put("notificationsAllowed", notificationsAllowed)
        .put("exactAlarmsAllowed", exactAlarmsAllowed)
        .apply { if (error != null) put("error", error) }
        .toString()
}

/**
 * Keeps AlarmManager in step with the server's list of upcoming reminders.
 * Every call replaces the whole schedule, so edited and deleted events are
 * cancelled. Exact alarms are used when the system allows them; otherwise a
 * Doze-tolerant inexact alarm (may fire a few minutes late).
 */
object ReminderScheduler {
    private const val TAG = "ReminderScheduler"
    private const val PREFS_NAME = "fit_tracker_reminders"
    private const val KEY_SCHEDULE = "schedule"
    private const val KEY_FIRED = "fired"
    const val ACTION_FIRE = "com.fittracker.reminders.FIRE"

    private const val MAX_REMINDERS = 60
    private const val MAX_FIRED_KEYS = 200
    private val KEY_RE = Regex("^[A-Za-z0-9_\\-]{1,64}:\\d{4}-\\d{2}-\\d{2}$")
    private val EVENT_ID_RE = Regex("^[A-Za-z0-9_\\-]{1,64}$")
    private val CATEGORIES = setOf("workout", "nutrition", "habit", "recovery", "focus", "other")

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ---- parsing & validation ----------------------------------------------

    /** Parses and validates a reminder list (from the server or the web app). Invalid items are skipped. */
    fun parse(array: JSONArray?, nowMs: Long = System.currentTimeMillis()): List<Reminder> {
        if (array == null) return emptyList()
        val result = ArrayList<Reminder>()
        val earliest = nowMs - 24L * 60 * 60 * 1000
        val latest = nowMs + 3L * 24 * 60 * 60 * 1000
        for (i in 0 until minOf(array.length(), 500)) {
            val item = array.optJSONObject(i) ?: continue
            val key = item.optString("key", "")
            val eventId = item.optString("eventId", "")
            val title = item.optString("title", "").trim().take(120)
            val description = item.optString("description", "").trim().take(300)
            val category = item.optString("category", "other").takeIf { it in CATEGORIES } ?: "other"
            val startsAt = item.optLong("startsAtMs", -1L)
            val notifyAt = item.optLong("notifyAtMs", -1L)
            if (!KEY_RE.matches(key) || !EVENT_ID_RE.matches(eventId) || title.isEmpty()) continue
            if (startsAt !in earliest..latest || notifyAt !in earliest..latest || notifyAt > startsAt) continue
            result.add(Reminder(key, eventId, title, description, category, startsAt, notifyAt))
        }
        return result.distinctBy { it.key }
    }

    private fun encode(reminders: List<Reminder>): String {
        val array = JSONArray()
        reminders.forEach {
            array.put(
                JSONObject()
                    .put("key", it.key)
                    .put("eventId", it.eventId)
                    .put("title", it.title)
                    .put("description", it.description)
                    .put("category", it.category)
                    .put("startsAtMs", it.startsAtMs)
                    .put("notifyAtMs", it.notifyAtMs)
            )
        }
        return array.toString()
    }

    private fun loadSchedule(context: Context): List<Reminder> = try {
        parse(JSONArray(prefs(context).getString(KEY_SCHEDULE, "[]") ?: "[]"))
    } catch (_: Exception) {
        emptyList()
    }

    fun find(context: Context, key: String): Reminder? = loadSchedule(context).firstOrNull { it.key == key }

    // ---- fired bookkeeping (a reminder never fires twice) ------------------

    private fun firedKeys(context: Context): MutableList<String> = try {
        val array = JSONArray(prefs(context).getString(KEY_FIRED, "[]") ?: "[]")
        MutableList(array.length()) { array.optString(it, "") }
    } catch (_: Exception) {
        mutableListOf()
    }

    @Synchronized
    fun markFired(context: Context, key: String) {
        val fired = firedKeys(context)
        if (!fired.contains(key)) fired.add(key)
        val trimmed = fired.takeLast(MAX_FIRED_KEYS)
        val remaining = loadSchedule(context).filter { it.key != key }
        prefs(context).edit()
            .putString(KEY_FIRED, JSONArray(trimmed).toString())
            .putString(KEY_SCHEDULE, encode(remaining))
            .apply()
    }

    // ---- permissions --------------------------------------------------------

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
        return alarmManager.canScheduleExactAlarms()
    }

    fun notificationsAllowed(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun status(context: Context, scheduled: Int = loadSchedule(context).size, error: String? = null) = ReminderStatus(
        ok = error == null,
        scheduled = scheduled,
        notificationsAllowed = notificationsAllowed(context),
        exactAlarmsAllowed = canScheduleExact(context),
        error = error
    )

    // ---- scheduling ---------------------------------------------------------

    private fun pendingIntent(context: Context, key: String, flags: Int): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_FIRE
            // The data URI makes each reminder's PendingIntent distinct.
            data = Uri.Builder().scheme("fittracker").authority("reminder").appendPath(key).build()
        }
        return PendingIntent.getBroadcast(context, 0, intent, flags or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun cancelAlarm(context: Context, alarmManager: AlarmManager, key: String) {
        pendingIntent(context, key, PendingIntent.FLAG_NO_CREATE)?.let {
            alarmManager.cancel(it)
            it.cancel()
        }
    }

    /** Replaces the whole schedule with `reminders`. */
    @Synchronized
    fun replaceAll(context: Context, reminders: List<Reminder>): ReminderStatus {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return status(context, 0, "Alarms are not available on this device")

        loadSchedule(context).forEach { cancelAlarm(context, alarmManager, it.key) }

        val now = System.currentTimeMillis()
        val fired = firedKeys(context).toHashSet()
        val upcoming = reminders
            .filter { it.startsAtMs > now && it.key !in fired }
            .sortedBy { it.notifyAtMs }
            .take(MAX_REMINDERS)

        val exact = canScheduleExact(context)
        var scheduled = 0
        for (reminder in upcoming) {
            val pending = pendingIntent(context, reminder.key, PendingIntent.FLAG_UPDATE_CURRENT) ?: continue
            // If the reminder time already passed but the event has not started, remind now.
            val triggerAt = maxOf(reminder.notifyAtMs, now + 2_000L)
            try {
                if (exact) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                }
                scheduled++
            } catch (e: SecurityException) {
                Log.w(TAG, "Exact alarm refused, using an inexact one: ${e.message}")
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
                scheduled++
            }
        }

        prefs(context).edit().putString(KEY_SCHEDULE, encode(upcoming)).apply()
        Log.d(TAG, "Scheduled $scheduled reminder(s), exact=$exact")
        return status(context, scheduled)
    }

    /** Re-arms the stored schedule (after a reboot, time change or permission change). */
    fun rescheduleStored(context: Context): ReminderStatus = replaceAll(context, loadSchedule(context))

    /** Cancels every reminder and forgets the schedule (logout). */
    @Synchronized
    fun clearAll(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        if (alarmManager != null) loadSchedule(context).forEach { cancelAlarm(context, alarmManager, it.key) }
        prefs(context).edit().clear().commit()
    }
}
