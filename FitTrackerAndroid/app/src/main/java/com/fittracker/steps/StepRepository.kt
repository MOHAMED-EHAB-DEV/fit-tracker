package com.fittracker.steps

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.CopyOnWriteArraySet

/** What the app knows about today's steps. */
data class StepSnapshot(
    val steps: Long,
    /** Local day ("YYYY-MM-DD", user's zone) the steps belong to. */
    val date: String,
    val timeZoneId: String,
    /** Wall-clock time of the last sensor reading, 0 if none. */
    val lastReadingAtMs: Long,
    /** "ok" | "permission_needed" | "permission_denied" | "unsupported" | "no_reading" */
    val status: String
)

/**
 * Turns raw TYPE_STEP_COUNTER values into per-day step totals.
 *
 * - Day boundaries are the user's time zone (set by the web app; device zone until then).
 * - Reboots are detected with Settings.Global.BOOT_COUNT (boot time as a fallback),
 *   never by "the value went down".
 * - Readings older than the last processed one (same boot) are ignored.
 * - Steps between two readings that span midnight are split across the days in
 *   proportion to the time in each day (an estimate: the phone cannot tell when
 *   they were taken), and every changed day is queued for upload under its own date.
 */
object StepRepository {

    private const val TAG = "StepRepository"
    private const val FLAGS_PREFS = "fit_tracker_step_flags"
    private const val KEY_PERMISSION_DENIED = "activity_permission_denied"

    /** Generous upper bound on walking/running cadence, steps per hour. */
    private const val MAX_STEPS_PER_HOUR = 15_000L
    private const val MIN_STEP_ALLOWANCE = 3_000L
    /** Days kept locally: today and yesterday (the server accepts nothing older). */
    private const val DAYS_KEPT = 2

    private val readMutex = Mutex()
    private val listeners = CopyOnWriteArraySet<(StepSnapshot) -> Unit>()

    fun addListener(listener: (StepSnapshot) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (StepSnapshot) -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyListeners(snapshot: StepSnapshot) {
        for (listener in listeners) {
            try {
                listener(snapshot)
            } catch (e: Exception) {
                Log.w(TAG, "Step listener failed: ${e.message}")
            }
        }
    }

    // ---- boot identity ------------------------------------------------------

    private fun currentBootCount(context: Context): Int = try {
        Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
    } catch (_: Exception) {
        -1
    }

    private fun currentBootWallMs(): Long = System.currentTimeMillis() - SystemClock.elapsedRealtime()

    // ---- permission flag (set by the Activity after a denial) ---------------

    fun setPermissionDenied(context: Context, denied: Boolean) {
        context.applicationContext.getSharedPreferences(FLAGS_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_PERMISSION_DENIED, denied).apply()
    }

    private fun wasPermissionDenied(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(FLAGS_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_PERMISSION_DENIED, false)

    fun status(context: Context, state: StepState = StepStore.load(context)): String = when {
        !StepSensorManager.isSupported(context) -> "unsupported"
        !StepSensorManager.hasActivityPermission(context) ->
            if (wasPermissionDenied(context)) "permission_denied" else "permission_needed"
        state.lastCounter < 0L && state.days.isEmpty() -> "no_reading"
        else -> "ok"
    }

    // ---- reads --------------------------------------------------------------

    fun getCachedTodaySteps(context: Context): Long {
        val today = StepStore.todayDateString(context)
        return StepStore.load(context).days[today] ?: 0L
    }

    fun snapshot(context: Context): StepSnapshot {
        val state = StepStore.load(context)
        val today = StepStore.todayDateString(context)
        return StepSnapshot(
            steps = state.days[today] ?: 0L,
            date = today,
            timeZoneId = StepStore.getTimeZoneId(context),
            lastReadingAtMs = state.lastWallMs,
            status = status(context, state)
        )
    }

    /**
     * Reads the sensor once and processes the value. Concurrent callers are
     * serialized, so two reads can never be processed out of order.
     */
    suspend fun readAndProcess(context: Context, timeoutMs: Long = StepSensorManager.DEFAULT_TIMEOUT_MS): StepSnapshot {
        return readMutex.withLock {
            val reading = StepSensorManager.readOnce(context, timeoutMs)
            if (reading != null) processReading(context, reading) else snapshot(context)
        }
    }

    /** Processes one reading (from a one-shot read or the live listener). */
    @Synchronized
    fun processReading(context: Context, reading: StepReading): StepSnapshot {
        val tz = StepStore.getTimeZone(context)
        val bootCount = currentBootCount(context)
        val bootWallMs = currentBootWallMs()
        val stored = StepStore.load(context)
        val today = DayMath.dateString(System.currentTimeMillis(), tz)

        val days = HashMap(stored.days)
        val pending = HashSet(stored.pending)

        val firstReading = stored.lastCounter < 0L
        val bootChanged = if (bootCount >= 0 && stored.bootCount >= 0) {
            bootCount != stored.bootCount
        } else {
            Math.abs(bootWallMs - stored.bootWallMs) > 2 * 60 * 1000L
        }
        val rebooted = !firstReading && bootChanged

        var credit = 0L
        var fromMs = reading.wallMs
        when {
            firstReading -> Log.d(TAG, "First reading ${reading.counter}: baseline only")
            rebooted -> {
                // The counter restarted at boot: everything on it was walked since then.
                credit = reading.counter
                fromMs = maxOf(bootWallMs, stored.lastWallMs)
                Log.d(TAG, "Reboot detected: crediting ${reading.counter} steps since boot")
            }
            reading.elapsedNs <= stored.lastElapsedNs -> {
                Log.d(TAG, "Ignoring an older or duplicate reading (${reading.counter})")
                return snapshot(context)
            }
            reading.counter < stored.lastCounter -> {
                Log.w(TAG, "Counter went down without a reboot (${stored.lastCounter} -> ${reading.counter}); new baseline")
            }
            else -> {
                credit = reading.counter - stored.lastCounter
                fromMs = stored.lastWallMs
            }
        }

        val toMs = maxOf(reading.wallMs, fromMs)
        if (credit > 0L) {
            val hours = (toMs - fromMs).toDouble() / 3_600_000.0
            val allowance = MIN_STEP_ALLOWANCE + (hours * MAX_STEPS_PER_HOUR).toLong()
            if (credit > allowance) {
                Log.w(TAG, "Implausible jump of $credit steps in ${"%.1f".format(hours)} h; not credited")
                credit = 0L
            }
        }

        val oldestKept = DayMath.addDays(today, -(DAYS_KEPT - 1))
        if (credit > 0L) {
            for ((date, share) in DayMath.splitAcrossDays(credit, fromMs, toMs, tz)) {
                if (date < oldestKept || date > today) {
                    Log.d(TAG, "Dropping $share steps for $date (outside the days the server accepts)")
                    continue
                }
                days[date] = (days[date] ?: 0L) + share
                pending.add(date)
            }
        }
        if (!days.containsKey(today)) days[today] = 0L

        val prunedDays = days.filterKeys { it in oldestKept..today }
        val prunedPending = pending.filter { it in oldestKept..today }.toSet()

        val newState = StepState(
            bootCount = bootCount,
            bootWallMs = bootWallMs,
            lastCounter = reading.counter,
            lastElapsedNs = reading.elapsedNs,
            lastWallMs = reading.wallMs,
            days = prunedDays,
            pending = prunedPending
        )
        StepStore.save(context, newState)
        if (wasPermissionDenied(context)) setPermissionDenied(context, false)

        val snapshot = StepSnapshot(
            steps = prunedDays[today] ?: 0L,
            date = today,
            timeZoneId = tz.id,
            lastReadingAtMs = reading.wallMs,
            status = "ok"
        )
        notifyListeners(snapshot)
        return snapshot
    }

    /** Re-labels today after a time-zone change or day rollover and tells listeners. */
    fun refresh(context: Context) {
        notifyListeners(snapshot(context))
    }

    /** Values still to upload, oldest first: date -> steps. */
    fun pendingUploads(context: Context): List<Pair<String, Long>> {
        val state = StepStore.load(context)
        val today = StepStore.todayDateString(context)
        val oldestKept = DayMath.addDays(today, -(DAYS_KEPT - 1))
        return state.pending
            .filter { it in oldestKept..today }
            .sorted()
            .map { it to (state.days[it] ?: 0L) }
    }

    /** Marks a day as uploaded, unless its total changed while the upload ran. */
    @Synchronized
    fun markUploaded(context: Context, date: String, uploadedSteps: Long) {
        val state = StepStore.load(context)
        if ((state.days[date] ?: 0L) != uploadedSteps) return
        StepStore.save(context, state.copy(pending = state.pending - date))
    }

    /** Drops a day the server refused (e.g. outside its accepted window). */
    @Synchronized
    fun dropPending(context: Context, date: String) {
        val state = StepStore.load(context)
        StepStore.save(context, state.copy(pending = state.pending - date))
    }

    /** Writes the current state synchronously (shutdown). */
    @Synchronized
    fun flush(context: Context) {
        StepStore.save(context, StepStore.load(context), synchronous = true)
    }
}
