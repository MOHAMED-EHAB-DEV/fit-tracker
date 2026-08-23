import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Dynamically resolve app version from the single source of truth (version.json)
fun getAppVersion(): Pair<Int, String> {
    val versionFile = File(rootDir, "../version.json")
    if (versionFile.exists()) {
        val content = versionFile.readText()
        val codeMatch = Regex("\"versionCode\"\\s*:\\s*(\\d+)").find(content)
        val nameMatch = Regex("\"versionName\"\\s*:\\s*\"([^\"]+)\"").find(content)
        val code = codeMatch?.groupValues?.get(1)?.toIntOrNull() ?: 1
        val name = nameMatch?.groupValues?.get(1) ?: "1.0.0"
        return Pair(code, name)
    }
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

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
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
}
