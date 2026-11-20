package com.fittracker.steps

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Calendar-day helpers in an explicit IANA time zone (the user's profile zone),
 * so the app and the server agree on what "today" is. java.util only (minSdk 24).
 */
object DayMath {

    private val DATE_RE = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    private val ZONE_RE = Regex("^[A-Za-z0-9_+\\-/]{1,64}$")

    private val knownZones: Set<String> by lazy { TimeZone.getAvailableIDs().toHashSet() }

    fun isValidZoneId(id: String?): Boolean =
        id != null && ZONE_RE.matches(id) && knownZones.contains(id)

    fun zone(id: String?): TimeZone =
        if (isValidZoneId(id)) TimeZone.getTimeZone(id) else TimeZone.getDefault()

    fun dateString(epochMs: Long, tz: TimeZone): String {
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        format.timeZone = tz
        return format.format(Date(epochMs))
    }

    fun isValidDateString(value: String?): Boolean {
        if (value == null || !DATE_RE.matches(value)) return false
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        format.isLenient = false
        format.timeZone = TimeZone.getTimeZone("UTC")
        return try {
            format.parse(value) != null
        } catch (_: Exception) {
            false
        }
    }

    /** `date` plus `days` calendar days ("YYYY-MM-DD"). */
    fun addDays(date: String, days: Int): String {
        val utc = TimeZone.getTimeZone("UTC")
        val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        format.timeZone = utc
        val parsed = format.parse(date) ?: return date
        val calendar = Calendar.getInstance(utc)
        calendar.time = parsed
        calendar.add(Calendar.DATE, days)
        return format.format(calendar.time)
    }

    /** First instant of the local day after the one containing `epochMs`. */
    fun startOfNextDay(epochMs: Long, tz: TimeZone): Long {
        val calendar = Calendar.getInstance(tz)
        calendar.timeInMillis = epochMs
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        calendar.add(Calendar.DATE, 1)
        val next = calendar.timeInMillis
        // Guard against zones whose midnight is skipped by a DST jump.
        return if (next > epochMs) next else epochMs + 24L * 60 * 60 * 1000
    }

    /**
     * Splits `total` steps taken between `fromMs` and `toMs` across the local
     * days of that interval, proportionally to the time spent in each day.
     * Returns date -> steps; the shares add up to `total`.
     */
    fun splitAcrossDays(total: Long, fromMs: Long, toMs: Long, tz: TimeZone): Map<String, Long> {
        if (total <= 0L) return emptyMap()
        val end = maxOf(fromMs, toMs)
        if (end <= fromMs) return mapOf(dateString(end, tz) to total)

        val segments = ArrayList<Pair<String, Long>>()
        var cursor = fromMs
        var guard = 0
        while (cursor < end && guard < 400) {
            val segmentEnd = minOf(startOfNextDay(cursor, tz), end)
            segments.add(dateString(cursor, tz) to (segmentEnd - cursor))
            cursor = segmentEnd
            guard++
        }
        val span = (end - fromMs).toDouble()
        val result = LinkedHashMap<String, Long>()
        var assigned = 0L
        segments.forEachIndexed { index, (date, length) ->
            val share = if (index == segments.lastIndex) {
                total - assigned
            } else {
                Math.floor(total * (length / span)).toLong()
            }
            assigned += share
            if (share > 0) result[date] = (result[date] ?: 0L) + share
        }
        return result
    }
}
