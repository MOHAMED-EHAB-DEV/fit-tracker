import java.io.File
import java.security.KeyStore
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Dynamically resolve app version from Gradle properties (-P), Env vars, or version.json
fun getAppVersion(): Pair<Int, String> {
    // 1. Check Gradle project property (e.g. -PversionCode=4 -PversionName=1.0.3)
    val propCode = if (project.hasProperty("versionCode")) {
        project.property("versionCode")?.toString()?.toIntOrNull()
    } else null
    val propName = if (project.hasProperty("versionName")) {
        project.property("versionName")?.toString()?.trim()
    } else null

    if (propCode != null && !propName.isNullOrBlank()) {
        println("FitTracker: Using Gradle property version: v$propName (code $propCode)")
        return Pair(propCode, propName)
    }

    // 2. Check System Environment variables
    val envCode = System.getenv("VERSION_CODE")?.toIntOrNull()
    val envName = System.getenv("VERSION_NAME")?.trim()
    if (envCode != null && !envName.isNullOrBlank()) {
        println("FitTracker: Using Environment version: v$envName (code $envCode)")
        return Pair(envCode, envName)
    }

    // 3. Search for version.json in multiple relative paths
    val searchPaths = listOf(
        File(rootDir, "../version.json"),
        File(rootDir, "version.json"),
        File(projectDir, "../../version.json"),
        File(projectDir, "../version.json"),
        File(rootProject.projectDir.parentFile, "version.json")
    )

    for (versionFile in searchPaths) {
        if (versionFile.exists()) {
            try {
                val content = versionFile.readText()
                val codeMatch = Regex("\"versionCode\"\\s*:\\s*(\\d+)").find(content)
                val nameMatch = Regex("\"versionName\"\\s*:\\s*\"([^\"]+)\"").find(content)
                val code = codeMatch?.groupValues?.get(1)?.toIntOrNull()
                val name = nameMatch?.groupValues?.get(1)?.trim()
                if (code != null && !name.isNullOrBlank()) {
                    println("FitTracker: Read version from ${versionFile.path}: v$name (code $code)")
                    return Pair(code, name)
                }
            } catch (e: Exception) {
                // Try next path
            }
        }
    }

    println("FitTracker: Fallback default version 1.0.0 (code 1)")
    return Pair(1, "1.0.0")
}

val (appVersionCode, appVersionName) = getAppVersion()

// ---------------------------------------------------------------------------
// Release signing: the private release key is NEVER committed. It is read from
// environment variables or Gradle properties (~/.gradle/gradle.properties or -P):
//   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
// Building a release without them fails. See FitTrackerAndroid/RELEASE_SIGNING.md.
// The committed keystore/debug.keystore is used by the debug build type only.
// ---------------------------------------------------------------------------
fun signingSecret(name: String): String? {
    val fromProperty = (findProperty(name) as String?)?.trim()
    if (!fromProperty.isNullOrEmpty()) return fromProperty
    val fromEnv = System.getenv(name)?.trim()
    return if (fromEnv.isNullOrEmpty()) null else fromEnv
}

val releaseKeystorePath = signingSecret("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = signingSecret("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = signingSecret("ANDROID_KEY_ALIAS")
val releaseKeyPassword = signingSecret("ANDROID_KEY_PASSWORD")
val releaseKeystoreFile = releaseKeystorePath?.let { file(it) }
val isReleaseSigningConfigured = releaseKeystoreFile != null && releaseKeystoreFile.isFile &&
    releaseKeystorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null

/** SHA-256 (lowercase hex) of the release certificate; pinned in BuildConfig for the updater. */
fun releaseCertificateSha256(): String {
    if (!isReleaseSigningConfigured) return ""
    return try {
        val keyStore = KeyStore.getInstance(releaseKeystoreFile!!, releaseKeystorePassword!!.toCharArray())
        val certificate = keyStore.getCertificate(releaseKeyAlias) ?: return ""
        MessageDigest.getInstance("SHA-256").digest(certificate.encoded)
            .joinToString("") { "%02x".format(it) }
    } catch (e: Exception) {
        throw GradleException("FitTracker: could not read the release keystore: ${e.message}")
    }
}

// Origin the WebView loads. Debug builds may point at a dev server with
// -PfittrackerDevOrigin=http://10.0.2.2:3000 (http allowed for localhost-style hosts only).
val productionOrigin = "https://fit-tracker-ai-prod.vercel.app"
val debugOrigin = (findProperty("fittrackerDevOrigin") as String?)?.trim()?.removeSuffix("/")
    ?.takeIf { Regex("^https?://[A-Za-z0-9.\\-]+(:\\d{1,5})?$").matches(it) }
    ?: productionOrigin

android {
    namespace = "com.fittracker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.fittracker"
        minSdk = 24
        targetSdk = 34
        versionCode = appVersionCode
        versionName = appVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        getByName("debug") {
            val ksFile = File(rootDir, "keystore/debug.keystore")
            if (ksFile.exists()) {
                storeFile = ksFile
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
        create("release") {
            if (isReleaseSigningConfigured) {
                storeFile = releaseKeystoreFile
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = if (isReleaseSigningConfigured) signingConfigs.getByName("release") else null
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "APP_ORIGIN", "\"$productionOrigin\"")
            buildConfigField("String", "RELEASE_CERT_SHA256", "\"${releaseCertificateSha256()}\"")
        }
        debug {
            isDebuggable = true
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
            buildConfigField("String", "APP_ORIGIN", "\"$debugOrigin\"")
            buildConfigField("String", "RELEASE_CERT_SHA256", "\"\"")
        }
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// Fail loudly instead of producing an unsigned or debug-signed release.
gradle.taskGraph.whenReady {
    val releaseTaskNames = setOf("assembleRelease", "bundleRelease", "packageRelease", "packageReleaseBundle")
    val buildsRelease = allTasks.any { it.project == project && it.name in releaseTaskNames }
    if (buildsRelease && !isReleaseSigningConfigured) {
        throw GradleException(
            "FitTracker: release signing is not configured. Set ANDROID_KEYSTORE_PATH, " +
                "ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD " +
                "(see FitTrackerAndroid/RELEASE_SIGNING.md)."
        )
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.activity:activity-ktx:1.8.2")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Markdown Parser & Renderer
    implementation("io.noties.markwon:core:4.6.2")
}
