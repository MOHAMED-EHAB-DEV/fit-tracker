package com.fittracker.webview

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.webkit.JavascriptInterface
import com.fittracker.AppConfig
import com.fittracker.BuildConfig
import com.fittracker.UserData
import com.fittracker.notification.PlannerNotificationManager
import com.fittracker.reminders.ReminderScheduler
import com.fittracker.steps.DayMath
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepSensorManager
import com.fittracker.steps.StepStore
import com.fittracker.update.AppUpdateManager
import com.fittracker.widget.FitTrackerFitnessWidget
import com.fittracker.widget.FitTrackerQuickWidget
import com.fittracker.widget.FitTrackerStepWidget
import com.fittracker.widget.FitTrackerWidgetUpdater
import com.fittracker.widget.WidgetDataStore
import org.json.JSONObject
import java.util.concurrent.Callable
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * What the bridge needs from the Activity that hosts the WebView.
 * All methods are called on the main thread.
 */
interface BridgeHost {
    /** URL of the WebView's main frame. */
    fun currentMainFrameUrl(): String?
    /** Reads the step sensor now, asking for permission in context if needed. */
    fun requestStepSync()
    /** Asks for POST_NOTIFICATIONS (with a rationale) when it is missing and may still be asked. */
    fun requestNotificationPermissionIfNeeded()
    fun openExternal(url: String): Boolean
    fun saveFile(base64: String, filename: String, mimeType: String): Boolean
    fun reportSaveFailure(tooLarge: Boolean)
    fun checkForUpdate()
    fun openNotificationSettings()
    fun openExactAlarmSettings()
    fun openAppSettings()
}

/**
 * `window.AndroidBridge`. Keep in sync with services/webview-bridge.ts.
 *
 * Every method first checks, on the UI thread, that the WebView's main frame
 * is on one of the app's own origins; otherwise it does nothing and returns a
 * neutral value. All inputs are validated and bounded.
 */
class JSBridge(
    context: Context,
    private val host: BridgeHost
) {

    companion object {
        private const val TAG = "JSBridge"
        private const val MAX_JSON_CHARS = 64 * 1024
        private const val MAX_REMINDER_JSON_CHARS = 256 * 1024
        /** Base64 of a 20 MB file. */
        private const val MAX_FILE_BASE64_CHARS = 28 * 1024 * 1024
        private const val NOTIFICATION_MIN_INTERVAL_MS = 1500L
        private val EVENT_ID_RE = Regex("^[A-Za-z0-9_\\-]{1,64}$")
        private val CATEGORIES = setOf("workout", "nutrition", "habit", "recovery", "focus", "other")
    }

    private val appContext: Context = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var lastNotificationAt = 0L
    @Volatile private var lastStepSyncAt = 0L

    // ---- caller check -------------------------------------------------------

    private fun <T> onMainThread(block: () -> T): T? {
        if (Looper.myLooper() == Looper.getMainLooper()) return block()
        val task = FutureTask<T>(Callable { block() })
        mainHandler.post(task)
        return try {
            task.get(2, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.w(TAG, "UI thread did not answer: ${e.message}")
            null
        }
    }

    /** Origin of the page calling the bridge, if it is one of the app's own origins. */
    private fun trustedOrigin(): String? {
        val url = onMainThread { host.currentMainFrameUrl() }
        val origin = AppConfig.normalizeOrigin(url)
        return if (AppConfig.isAllowedOrigin(origin)) origin else null
    }

    private fun isTrustedCaller(): Boolean {
        val trusted = trustedOrigin() != null
        if (!trusted) Log.w(TAG, "Bridge call refused: page is not on the app origin")
        return trusted
    }

    private fun clampInt(obj: JSONObject, key: String, min: Int, max: Int): Int? {
        if (!obj.has(key) || obj.isNull(key)) return null
        val value = obj.optDouble(key, Double.NaN)
        if (value.isNaN() || value.isInfinite()) return null
        return value.toLong().coerceIn(min.toLong(), max.toLong()).toInt()
    }

    // ---- app ----------------------------------------------------------------

    @JavascriptInterface
    fun isNativeApp(): Boolean = isTrustedCaller()

    @JavascriptInterface
    fun getAppVersion(): String {
        if (!isTrustedCaller()) return "{}"
        val manager = AppUpdateManager(appContext)
        return JSONObject()
            .put("versionName", manager.getInstalledVersionName())
            .put("versionCode", manager.getInstalledVersionCode())
            .put("buildType", BuildConfig.BUILD_TYPE)
            .toString()
    }

    @JavascriptInterface
    fun checkForUpdate() {
        if (!isTrustedCaller()) return
        mainHandler.post { host.checkForUpdate() }
    }

    @JavascriptInterface
    fun openExternalUrl(url: String?): Boolean {
        if (!isTrustedCaller() || url.isNullOrBlank() || url.length > 2048) return false
        return onMainThread { host.openExternal(url) } ?: false
    }

    @JavascriptInterface
    fun saveFile(base64: String?, filename: String?, mimeType: String?): Boolean {
        if (!isTrustedCaller()) return false
        if (base64.isNullOrEmpty() || base64.length > MAX_FILE_BASE64_CHARS) {
            val tooLarge = base64 != null && base64.length > MAX_FILE_BASE64_CHARS
            mainHandler.post { host.reportSaveFailure(tooLarge) }
            return false
        }
        val safeName = (filename ?: "").replace(Regex("[^A-Za-z0-9._\\- ]"), "_").trim().take(100)
            .ifBlank { "fittracker-export" }
        val safeMime = (mimeType ?: "").takeIf { Regex("^[a-z]+/[A-Za-z0-9.+\\-]{1,80}$").matches(it) }
            ?: "application/octet-stream"
        return onMainThread { host.saveFile(base64, safeName, safeMime) } ?: false
    }

    // ---- session ------------------------------------------------------------

    /** {"timeZone":"Africa/Cairo"}: the signed-in user's zone. Also marks the session as active. */
    @JavascriptInterface
    fun setUserContext(json: String?) {
        val origin = trustedOrigin() ?: return
        if (json.isNullOrBlank() || json.length > MAX_JSON_CHARS) return
        val zone = try {
            JSONObject(json).optString("timeZone", "")
        } catch (_: Exception) {
            return
        }
        val previousZone = StepStore.getTimeZoneId(appContext)
        if (!StepStore.setTimeZoneId(appContext, zone)) {
            Log.w(TAG, "Ignoring unknown time zone")
        }
        StepStore.setServerUrl(appContext, origin)
        UserData.onSignedIn(appContext)
        if (previousZone != StepStore.getTimeZoneId(appContext)) StepRepository.refresh(appContext)
    }

    /** Validated origin only (kept for older web builds). */
    @JavascriptInterface
    fun setServerUrl(url: String?) {
        val origin = trustedOrigin() ?: return
        if (AppConfig.normalizeOrigin(url) == origin) StepStore.setServerUrl(appContext, origin)
    }

    /** Logout: wipes steps, widget numbers, scheduled reminders and notifications. */
    @JavascriptInterface
    fun clearUserData() {
        if (!isTrustedCaller()) return
        UserData.clearAll(appContext)
    }

    // ---- steps --------------------------------------------------------------

    @JavascriptInterface
    fun getTodaySteps(): Long {
        if (!isTrustedCaller()) return 0L
        return StepRepository.getCachedTodaySteps(appContext)
    }

    @JavascriptInterface
    fun getStepSnapshot(): String {
        if (!isTrustedCaller()) return "{}"
        val snapshot = StepRepository.snapshot(appContext)
        return JSONObject()
            .put("steps", snapshot.steps)
            .put("date", snapshot.date)
            .put("timeZone", snapshot.timeZoneId)
            .put("lastReadingAt", snapshot.lastReadingAtMs)
            .put("status", snapshot.status)
            .toString()
    }

    @JavascriptInterface
    fun getSensorInfo(): String {
        if (!isTrustedCaller()) return "{}"
        val meta = StepSensorManager.getMetadata(appContext)
        val permission = when {
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q -> "not_required"
            StepSensorManager.hasActivityPermission(appContext) -> "granted"
            else -> "denied"
        }
        return JSONObject()
            .put("name", meta?.name ?: "Unavailable")
            .put("vendor", meta?.vendor ?: "")
            .put("version", meta?.version ?: 0)
            .put("powerMa", (meta?.powerMa ?: 0f).toDouble())
            .put("type", if (meta != null) "STEP_COUNTER" else "NONE")
            .put("isWakeUp", meta?.isWakeUp ?: false)
            .put("supported", meta != null)
            .put("permission", permission)
            .toString()
    }

    @JavascriptInterface
    fun requestStepSync() {
        if (!isTrustedCaller()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastStepSyncAt < 1000L) return
        lastStepSyncAt = now
        mainHandler.post { host.requestStepSync() }
    }

    // ---- widgets ------------------------------------------------------------

    /** The dashboard's numbers for a day (server values). Unknown or out-of-range fields are ignored. */
    @JavascriptInterface
    fun updateWidgetData(json: String?) {
        if (!isTrustedCaller()) return
        if (json.isNullOrBlank() || json.length > MAX_JSON_CHARS) return
        try {
            val obj = JSONObject(json)
            val date = obj.optString("date", "").takeIf { DayMath.isValidDateString(it) }
            WidgetDataStore.applyWebUpdate(
                appContext,
                WidgetDataStore.WebUpdate(
                    date = date,
                    serverSteps = clampInt(obj, "steps", 0, 200_000)?.toLong(),
                    stepGoal = clampInt(obj, "stepGoal", 100, 200_000),
                    caloriesIn = clampInt(obj, "caloriesIn", 0, 50_000),
                    targetCalories = clampInt(obj, "targetCalories", 500, 20_000),
                    waterMl = clampInt(obj, "waterMl", 0, 30_000),
                    waterGoalMl = clampInt(obj, "waterGoalMl", 250, 30_000),
                    streakDays = clampInt(obj, "streakDays", 0, 100_000)
                )
            )
            FitTrackerWidgetUpdater.updateAllWidgets(appContext)
        } catch (e: Exception) {
            Log.w(TAG, "Ignoring invalid widget data: ${e.message}")
        }
    }

    @JavascriptInterface
    fun isPinWidgetSupported(): Boolean {
        if (!isTrustedCaller()) return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val manager = appContext.getSystemService(AppWidgetManager::class.java) ?: return false
        return manager.isRequestPinAppWidgetSupported
    }

    @JavascriptInterface
    fun pinWidget(type: String?): Boolean {
        if (!isTrustedCaller()) return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val provider = when (type) {
            "small" -> FitTrackerQuickWidget::class.java
            "medium" -> FitTrackerStepWidget::class.java
            "large" -> FitTrackerFitnessWidget::class.java
            else -> return false
        }
        val manager = appContext.getSystemService(AppWidgetManager::class.java) ?: return false
        if (!manager.isRequestPinAppWidgetSupported) return false
        return try {
            manager.requestPinAppWidget(ComponentName(appContext, provider), null, null)
        } catch (e: Exception) {
            Log.e(TAG, "requestPinAppWidget failed: ${e.message}")
            false
        }
    }

    // ---- notifications & reminders -----------------------------------------

    @JavascriptInterface
    fun showNotification(eventId: String?, title: String?, description: String?, category: String?) {
        if (!isTrustedCaller()) return
        val id = eventId?.takeIf { EVENT_ID_RE.matches(it) } ?: return
        val cleanTitle = title?.trim()?.take(120)?.takeIf { it.isNotEmpty() } ?: return
        val cleanDescription = (description ?: "").trim().take(300)
        val cleanCategory = category?.takeIf { it in CATEGORIES } ?: "other"
        val now = SystemClock.elapsedRealtime()
        if (now - lastNotificationAt < NOTIFICATION_MIN_INTERVAL_MS) return
        lastNotificationAt = now
        mainHandler.post {
            host.requestNotificationPermissionIfNeeded()
            PlannerNotificationManager.showNotification(appContext, id, cleanTitle, cleanDescription, cleanCategory)
        }
    }

    /** {"reminders":[...]} from GET /api/planner/upcoming. Replaces the schedule. */
    @JavascriptInterface
    fun setPlannerReminders(json: String?): String {
        if (!isTrustedCaller()) return ReminderScheduler.status(appContext, 0, "Not allowed").toJson()
        if (json.isNullOrBlank() || json.length > MAX_REMINDER_JSON_CHARS) {
            return ReminderScheduler.status(appContext, 0, "Invalid reminder list").toJson()
        }
        val reminders = try {
            ReminderScheduler.parse(JSONObject(json).optJSONArray("reminders"))
        } catch (_: Exception) {
            return ReminderScheduler.status(appContext, 0, "Invalid reminder list").toJson()
        }
        val status = ReminderScheduler.replaceAll(appContext, reminders)
        if (reminders.isNotEmpty() && !status.notificationsAllowed) {
            mainHandler.post { host.requestNotificationPermissionIfNeeded() }
        }
        return status.toJson()
    }

    @JavascriptInterface
    fun getReminderStatus(): String {
        if (!isTrustedCaller()) return "{}"
        return ReminderScheduler.status(appContext).toJson()
    }

    @JavascriptInterface
    fun openNotificationSettings() {
        if (!isTrustedCaller()) return
        mainHandler.post { host.openNotificationSettings() }
    }

    @JavascriptInterface
    fun openExactAlarmSettings() {
        if (!isTrustedCaller()) return
        mainHandler.post { host.openExactAlarmSettings() }
    }

    @JavascriptInterface
    fun openAppSettings() {
        if (!isTrustedCaller()) return
        mainHandler.post { host.openAppSettings() }
    }
}
