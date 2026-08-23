package com.fittracker.steps

import android.content.Context
import android.util.Log

/**
 * Rock-solid step calculation repository.
 * Handles hardware pedometer deltas, midnight day-rollover baselines,
 * device reboots, and sensor anomaly protection.
 */
object StepRepository {

    private const val TAG = "StepRepository"
    private const val MAX_PLAUSIBLE_DELTA = 50_000L // Safeguard against hardware driver glitch spikes

    /**
     * Calculates today's step count using delta calculation and device reboot detection.
     * Sensor.TYPE_STEP_COUNTER returns the cumulative steps taken since the last device reboot.
     */
    @Synchronized
    fun processNewSensorReading(context: Context, currentSensorReading: Long): Long {
        if (currentSensorReading < 0) {
            Log.w(TAG, "Received negative sensor reading: $currentSensorReading. Ignoring.")
            return StepStore.load(context).todaySteps
        }

        val todayStr = StepStore.getTodayDateString()
        val stored = StepStore.load(context)

        // Case 1: First time initializing the step counter on this device
        if (stored.lastDateString.isEmpty() || stored.baseSensorValue < 0L || stored.lastSensorValue < 0L) {
            val initialState = StepState(
                lastDateString = todayStr,
                baseSensorValue = currentSensorReading,
                lastSensorValue = currentSensorReading,
                todaySteps = 0L
            )
            StepStore.save(context, initialState)
            Log.d(TAG, "Initialized baseline for $todayStr with sensor value: $currentSensorReading")
            return 0L
        }

        // Case 2: Day boundary crossed (New day detected)
        if (stored.lastDateString != todayStr) {
            val stepsToday: Long
            val baseSensor: Long

            if (currentSensorReading >= stored.lastSensorValue) {
                // Device did NOT reboot overnight: baseline is yesterday's final sensor value
                val deltaSinceYesterday = currentSensorReading - stored.lastSensorValue
                val sanitizedDelta = if (deltaSinceYesterday > MAX_PLAUSIBLE_DELTA) 0L else deltaSinceYesterday

                stepsToday = sanitizedDelta
                baseSensor = stored.lastSensorValue
                Log.d(TAG, "Day rollover without reboot. Steps taken since midnight: $stepsToday (baseline: $baseSensor)")
            } else {
                // Device rebooted overnight: counter reset to 0
                stepsToday = if (currentSensorReading > MAX_PLAUSIBLE_DELTA) 0L else currentSensorReading
                baseSensor = 0L
                Log.d(TAG, "Day rollover with reboot detected. Steps taken since reboot: $stepsToday")
            }

            val newDayState = StepState(
                lastDateString = todayStr,
                baseSensorValue = baseSensor,
                lastSensorValue = currentSensorReading,
                todaySteps = stepsToday
            )
            StepStore.save(context, newDayState)
            return stepsToday
        }

        // Case 3: Same day update
        val calculatedSteps: Long = when {
            // Normal case: sensor value monotonically increased
            currentSensorReading >= stored.lastSensorValue -> {
                val delta = currentSensorReading - stored.lastSensorValue
                if (delta > MAX_PLAUSIBLE_DELTA) {
                    Log.w(TAG, "Implausible delta detected: $delta. Retaining previous step count.")
                    stored.todaySteps
                } else {
                    stored.todaySteps + delta
                }
            }
            // Device rebooted DURING the current day: currentSensorReading is steps since reboot
            else -> {
                Log.d(TAG, "Mid-day reboot detected. Adding $currentSensorReading steps to today's existing ${stored.todaySteps}")
                if (currentSensorReading > MAX_PLAUSIBLE_DELTA) {
                    stored.todaySteps
                } else {
                    stored.todaySteps + currentSensorReading
                }
            }
        }

        val updatedState = stored.copy(
            lastSensorValue = currentSensorReading,
            todaySteps = calculatedSteps
        )
        StepStore.save(context, updatedState)

        return calculatedSteps
    }

    /**
     * Gets the currently cached step count for today without querying hardware.
     */
    fun getCachedTodaySteps(context: Context): Long {
        val todayStr = StepStore.getTodayDateString()
        val stored = StepStore.load(context)
        return if (stored.lastDateString == todayStr) stored.todaySteps else 0L
    }
}
