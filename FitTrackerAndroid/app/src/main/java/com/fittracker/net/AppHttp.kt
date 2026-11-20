package com.fittracker.net

import android.content.Context
import android.util.Log
import android.webkit.CookieManager
import com.fittracker.steps.StepStore
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Background requests to the app's own server, authenticated with the
 * WebView's session cookie (the same session the user signed in with).
 * No bearer tokens. Requests go only to an allowed origin.
 */
object AppHttp {
    private const val TAG = "AppHttp"
    private const val CONNECT_TIMEOUT_MS = 10_000
    private const val READ_TIMEOUT_MS = 15_000
    private const val MAX_BODY_BYTES = 512 * 1024

    data class Response(val code: Int, val body: String?)

    /** Status used when there is no session cookie at all. */
    const val NO_SESSION = 401

    /**
     * The session cookie, or null when there is none. A cookie store that cannot
     * be read right now (WebView being updated) is a temporary failure, not a
     * signed-out user: it throws IOException so workers retry later instead of
     * clearing the user's reminders and widgets.
     */
    @Throws(IOException::class)
    private fun sessionCookie(origin: String): String? = try {
        CookieManager.getInstance().getCookie(origin)?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        Log.w(TAG, "Cookie store unavailable: ${e.message}")
        throw IOException("Cookie store unavailable", e)
    }

    @Throws(IOException::class)
    fun request(context: Context, method: String, path: String, jsonBody: String? = null): Response {
        require(path.startsWith("/") && !path.startsWith("//")) { "Path must be app-relative" }
        val origin = StepStore.getServerUrl(context)
        val cookie = sessionCookie(origin) ?: return Response(NO_SESSION, null)

        val connection = URL(origin + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.instanceFollowRedirects = false
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cookie", cookie)
            if (jsonBody != null) {
                val bytes = jsonBody.toByteArray(Charsets.UTF_8)
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.outputStream.use { it.write(bytes) }
            }

            val code = connection.responseCode
            storeRenewedCookies(origin, connection)
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.use { readLimited(it) }
            return Response(code, body)
        } finally {
            connection.disconnect()
        }
    }

    /** The server renews long-lived sessions with Set-Cookie; keep the WebView's jar in step. */
    private fun storeRenewedCookies(origin: String, connection: HttpURLConnection) {
        try {
            val headers = connection.headerFields ?: return
            val cookies = headers.entries
                .filter { it.key != null && it.key.equals("Set-Cookie", ignoreCase = true) }
                .flatMap { it.value ?: emptyList() }
            if (cookies.isEmpty()) return
            val manager = CookieManager.getInstance()
            cookies.forEach { manager.setCookie(origin, it) }
            manager.flush()
        } catch (e: Exception) {
            Log.w(TAG, "Could not store renewed cookie: ${e.message}")
        }
    }

    private fun readLimited(input: InputStream): String {
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read == -1) break
            total += read
            if (total > MAX_BODY_BYTES) throw IOException("Response too large")
            out.write(buffer, 0, read)
        }
        return out.toString("UTF-8")
    }
}
