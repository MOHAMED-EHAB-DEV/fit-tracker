# FitTracker release (R8) rules.

# The WebView calls these methods by name through window.AndroidBridge.
-keepattributes JavascriptInterface
-keepclassmembers class com.fittracker.webview.JSBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.fittracker.webview.JSBridge

# Markwon (release notes renderer) references optional modules that are not bundled.
-dontwarn io.noties.markwon.**
-dontwarn org.commonmark.**

# Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
