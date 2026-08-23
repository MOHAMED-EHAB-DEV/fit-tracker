package com.fittracker.steps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

data class StepSensorMetadata(
    val name: String,
    val vendor: String,
    val version: Int,
    val powerMa: Float,
    val type: String,
    val isWakeUp: Boolean
)

/**
 * Ultra-low-power, high-accuracy Step Sensor Manager.
 * Dynamically resolves and binds to the latest, highest-fidelity hardware pedometer sensor
 * available on the host SoC (Qualcomm, MediaTek, Exynos, Google Tensor).
 */
object StepSensorManager {

    private const val TAG = "StepSensorManager"
    private const val DEFAULT_TIMEOUT_MS = 2500L

    /**
     * Resolves the latest and most power-efficient step sensor available on the device.
     * Prioritizes hardware TYPE_STEP_COUNTER with highest sensor version and lowest power draw.
     */
    fun getLatestAvailableStepSensor(sensorManager: SensorManager): Sensor? {
        // 1. Query all hardware step counter sensors
        val stepCounterSensors = sensorManager.getSensorList(Sensor.TYPE_STEP_COUNTER)

        if (stepCounterSensors.isNotEmpty()) {
            // Sort by version (highest/latest first), then by power efficiency (lowest power first)
            val bestSensor = stepCounterSensors.minWithOrNull(
                compareByDescending<Sensor> { it.version }
                    .thenBy { it.power }
            )
            if (bestSensor != null) {
                Log.d(TAG, "Selected latest TYPE_STEP_COUNTER: ${bestSensor.name} v${bestSensor.version} by ${bestSensor.vendor} (power: ${bestSensor.power}mA)")
                return bestSensor
            }
        }

        // 2. Fall back to system default TYPE_STEP_COUNTER (API 21+ non-wake-up preference for battery)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val nonWakeupSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER, false)
            if (nonWakeupSensor != null) {
                Log.d(TAG, "Selected default non-wake-up TYPE_STEP_COUNTER: ${nonWakeupSensor.name}")
                return nonWakeupSensor
            }
        }

        val defaultCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (defaultCounter != null) {
            Log.d(TAG, "Selected default TYPE_STEP_COUNTER: ${defaultCounter.name}")
            return defaultCounter
        }

        // 3. Fallback check for TYPE_STEP_DETECTOR if device lacks step counter accumulator
        val stepDetectors = sensorManager.getSensorList(Sensor.TYPE_STEP_DETECTOR)
        if (stepDetectors.isNotEmpty()) {
            val latestDetector = stepDetectors.maxByOrNull { it.version }
            Log.w(TAG, "TYPE_STEP_COUNTER unavailable. Falling back to latest TYPE_STEP_DETECTOR: ${latestDetector?.name}")
            return latestDetector
        }

        Log.e(TAG, "No hardware step sensor found on this device.")
        return null
    }

    /**
     * Reads current step count using the best available sensor with zero unnecessary battery usage.
     * Guaranteed to return or timeout within [timeoutMs].
     */
    suspend fun readCurrentCount(context: Context, timeoutMs: Long = DEFAULT_TIMEOUT_MS): Long? {
        return withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine { continuation ->
                val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
                if (sensorManager == null) {
                    if (continuation.isActive) continuation.resume(null)
                    return@suspendCancellableCoroutine
                }

                val stepSensor = getLatestAvailableStepSensor(sensorManager)
                if (stepSensor == null) {
                    if (continuation.isActive) continuation.resume(null)
                    return@suspendCancellableCoroutine
                }

                val isCompleted = AtomicBoolean(false)

                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent?) {
                        if (event != null && event.values.isNotEmpty()) {
                            if (isCompleted.compareAndSet(false, true)) {
                                sensorManager.unregisterListener(this)
                                val reading = event.values[0].toLong()
                                if (continuation.isActive) {
                                    continuation.resume(reading)
                                }
                            }
                        }
                    }

                    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
                }

                val registered = sensorManager.registerListener(
                    listener,
                    stepSensor,
                    SensorManager.SENSOR_DELAY_NORMAL
                )

                if (!registered) {
                    if (continuation.isActive) continuation.resume(null)
                    return@suspendCancellableCoroutine
                }

                // Immediately flush hardware sensor buffer on API 19+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    try {
                        sensorManager.flush(listener)
                    } catch (_: Exception) {
                        // Safe fallback on proprietary sensor hubs
                    }
                }

                continuation.invokeOnCancellation {
                    if (isCompleted.compareAndSet(false, true)) {
                        sensorManager.unregisterListener(listener)
                    }
                }
            }
        }
    }

    /**
     * Returns diagnostic information about the active pedometer hardware.
     */
    fun getActiveSensorMetadata(context: Context): StepSensorMetadata? {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return null
        val sensor = getLatestAvailableStepSensor(sensorManager) ?: return null

        val isWakeUp = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            sensor.isWakeUpSensor
        } else {
            false
        }

        return StepSensorMetadata(
            name = sensor.name,
            vendor = sensor.vendor,
            version = sensor.version,
            powerMa = sensor.power,
            type = if (sensor.type == Sensor.TYPE_STEP_COUNTER) "STEP_COUNTER" else "STEP_DETECTOR",
            isWakeUp = isWakeUp
        )
    }
}
