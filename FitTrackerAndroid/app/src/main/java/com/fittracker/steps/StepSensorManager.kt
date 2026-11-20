package com.fittracker.steps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

data class StepSensorMetadata(
    val name: String,
    val vendor: String,
    val version: Int,
    val powerMa: Float,
    val isWakeUp: Boolean
)

/** One TYPE_STEP_COUNTER value with the time it was measured. */
data class StepReading(
    /** Steps since the device booted (the sensor's cumulative value). */
    val counter: Long,
    /** Sensor timestamp in elapsed-realtime nanoseconds (monotonic within one boot). */
    val elapsedNs: Long,
    /** Wall-clock time of the measurement. */
    val wallMs: Long
)

/**
 * Access to the hardware step counter (TYPE_STEP_COUNTER only).
 *
 * Phones that only have TYPE_STEP_DETECTOR are reported as unsupported: a
 * detector only reports steps while an app listens, so one-shot reads cannot
 * count anything and the app would show a misleading 0.
 *
 * Android delivers step events only to apps in the foreground (or with a
 * foreground service), so readings happen while the app is open and when a
 * widget's Sync button starts [StepReadService].
 */
object StepSensorManager {

    private const val TAG = "StepSensorManager"
    const val DEFAULT_TIMEOUT_MS = 3000L

    fun hasActivityPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
            PackageManager.PERMISSION_GRANTED

    private fun stepCounter(context: Context): Pair<SensorManager, Sensor>? {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return null
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
        return sensorManager to sensor
    }

    fun isSupported(context: Context): Boolean = stepCounter(context) != null

    fun getMetadata(context: Context): StepSensorMetadata? {
        val (_, sensor) = stepCounter(context) ?: return null
        return StepSensorMetadata(
            name = sensor.name ?: "Step counter",
            vendor = sensor.vendor ?: "",
            version = sensor.version,
            powerMa = sensor.power,
            isWakeUp = sensor.isWakeUpSensor
        )
    }

    /** Converts a sensor event into a reading with a trustworthy timestamp. */
    private fun toReading(event: SensorEvent): StepReading? {
        if (event.values.isEmpty()) return null
        val value = event.values[0]
        if (value.isNaN() || value < 0f) return null
        val nowNs = SystemClock.elapsedRealtimeNanos()
        // Some sensor HALs use another time base; fall back to the receive time.
        val timestamp = if (event.timestamp in 1..(nowNs + 5_000_000_000L)) event.timestamp else nowNs
        val wallMs = System.currentTimeMillis() - (nowNs - timestamp) / 1_000_000L
        return StepReading(value.toLong(), timestamp, wallMs)
    }

    /**
     * Reads the current counter value once. Returns null on timeout, without
     * permission or without a step counter.
     */
    suspend fun readOnce(context: Context, timeoutMs: Long = DEFAULT_TIMEOUT_MS): StepReading? {
        if (!hasActivityPermission(context)) return null
        val (sensorManager, sensor) = stepCounter(context) ?: return null

        return withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine { continuation ->
                val done = AtomicBoolean(false)
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent?) {
                        val reading = event?.let { toReading(it) } ?: return
                        if (done.compareAndSet(false, true)) {
                            sensorManager.unregisterListener(this)
                            if (continuation.isActive) continuation.resume(reading)
                        }
                    }

                    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
                }

                val registered = try {
                    sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                } catch (e: SecurityException) {
                    Log.w(TAG, "Step counter registration refused: ${e.message}")
                    false
                }
                if (!registered) {
                    if (done.compareAndSet(false, true) && continuation.isActive) continuation.resume(null)
                    return@suspendCancellableCoroutine
                }
                try {
                    sensorManager.flush(listener)
                } catch (_: Exception) {
                    // Not every sensor hub supports flush; the first event still arrives.
                }
                continuation.invokeOnCancellation {
                    if (done.compareAndSet(false, true)) sensorManager.unregisterListener(listener)
                }
            }
        }
    }

    /**
     * Continuous updates while the app is in the foreground.
     * Returns a handle that must be passed to [stopLive], or null if unavailable.
     */
    fun startLive(context: Context, onReading: (StepReading) -> Unit): SensorEventListener? {
        if (!hasActivityPermission(context)) return null
        val (sensorManager, sensor) = stepCounter(context) ?: return null
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent?) {
                val reading = event?.let { toReading(it) } ?: return
                onReading(reading)
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        return try {
            if (sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)) listener else null
        } catch (e: SecurityException) {
            Log.w(TAG, "Live step counter registration refused: ${e.message}")
            null
        }
    }

    fun stopLive(context: Context, listener: SensorEventListener?) {
        if (listener == null) return
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        sensorManager.unregisterListener(listener)
    }
}
