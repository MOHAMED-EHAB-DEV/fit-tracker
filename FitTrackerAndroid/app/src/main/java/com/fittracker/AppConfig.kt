package com.fittracker

import android.net.Uri
import java.util.Locale

/**
 * The web origins this app trusts. Only these load inside the WebView, only
 * these may call the JavaScript bridge, and background requests go only here.
 */
object AppConfig {

    /** Production origin (release) or the dev server chosen at build time (debug). */
    val APP_ORIGIN: String = BuildConfig.APP_ORIGIN.trimEnd('/')

    private val DEBUG_LOCAL_ORIGINS = listOf(
        "http://10.0.2.2:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    )

    val allowedOrigins: Set<String> = buildSet {
        add(normalizeOrigin(APP_ORIGIN) ?: APP_ORIGIN)
        if (BuildConfig.DEBUG) addAll(DEBUG_LOCAL_ORIGINS)
    }

    /**
     * Start page: Today. "/" is the public landing page; the web app sends a
     * signed-in visitor from there to /dashboard and a signed-out one inside
     * this app to /login, so older builds that still start at "/" keep working.
     */
    val startUrl: String get() = "$APP_ORIGIN/dashboard"

    /** "scheme://host[:port]" in lower case, or null for anything that is not http(s). */
    fun normalizeOrigin(url: String?): String? {
        if (url.isNullOrBlank()) return null
        val uri = try {
            Uri.parse(url.trim())
        } catch (_: Exception) {
            return null
        }
        return originOf(uri)
    }

    fun originOf(uri: Uri?): String? {
        if (uri == null) return null
        val scheme = uri.scheme?.lowercase(Locale.US) ?: return null
        if (scheme != "https" && scheme != "http") return null
        val host = uri.host?.lowercase(Locale.US) ?: return null
        if (host.isEmpty()) return null
        val port = uri.port
        val defaultPort = if (scheme == "https") 443 else 80
        return if (port == -1 || port == defaultPort) "$scheme://$host" else "$scheme://$host:$port"
    }

    fun isAllowedOrigin(origin: String?): Boolean = origin != null && origin in allowedOrigins

    fun isAppUrl(url: String?): Boolean = isAllowedOrigin(normalizeOrigin(url))

    fun isAppUri(uri: Uri?): Boolean = isAllowedOrigin(originOf(uri))

    private val ROUTE_RE = Regex("^/[A-Za-z0-9/_\\-]{0,100}$")

    /** An in-app path such as "/planner" (no scheme, host, query or "//"). */
    fun isSafeRoute(route: String?): Boolean =
        route != null && ROUTE_RE.matches(route) && !route.contains("//")
}
