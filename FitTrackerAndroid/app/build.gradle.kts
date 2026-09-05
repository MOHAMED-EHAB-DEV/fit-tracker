import java.io.File

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
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
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
