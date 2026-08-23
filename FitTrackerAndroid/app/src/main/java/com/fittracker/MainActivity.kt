package com.fittracker

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.fittracker.steps.StepRepository
import com.fittracker.steps.StepStore
import com.fittracker.steps.StepSyncScheduler
import com.fittracker.update.AppUpdateManager
import com.fittracker.webview.JSBridge
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    private lateinit var webView: WebView
    private lateinit var jsBridge: JSBridge
    private lateinit var updateManager: AppUpdateManager

    // Configurable endpoint (local emulator default or production domain)
    private val appUrl = "https://fit-tracker-ai-prod.vercel.app/"

    // File Chooser state for photo captures and uploads
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoPath: String? = null
    private var cameraPhotoUri: Uri? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback == null) return@registerForActivityResult

        var results: Array<Uri>? = null

        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            if (data?.data != null) {
                // User selected a single file from gallery/documents
                results = arrayOf(data.data!!)
            } else if (data?.clipData != null) {
                // User selected multiple files
                val clipData = data.clipData!!
                results = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (cameraPhotoUri != null && cameraPhotoPath != null) {
                // User took a photo with the camera
                val photoFile = File(cameraPhotoPath!!)
                if (photoFile.exists() && photoFile.length() > 0) {
                    results = arrayOf(cameraPhotoUri!!)
                }
            }
        }

        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACTIVITY_RECOGNITION] == true) {
            StepSyncScheduler.schedulePeriodicSync(this)
            jsBridge.requestStepSync()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Store active base URL for background sync
        StepStore.setServerUrl(this, appUrl)

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
            }

            // Ensure cookies are saved and synced
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    cookieManager.flush()
                    // Push initial step count to the loaded page
                    val cachedSteps = StepRepository.getCachedTodaySteps(this@MainActivity)
                    jsBridge.pushStepCount(cachedSteps)
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    return false // Keep inside WebView
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    // Cancel any existing pending callback to prevent leaks/hangs
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback

                    return try {
                        launchFileChooser(fileChooserParams)
                        true
                    } catch (e: Exception) {
                        Log.e(TAG, "Error opening file chooser: ${e.localizedMessage}", e)
                        filePathCallback?.onReceiveValue(null)
                        filePathCallback = null
                        false
                    }
                }
            }

            jsBridge = JSBridge(this@MainActivity, this)
            addJavascriptInterface(jsBridge, "AndroidBridge")
        }

        setContentView(webView)

        checkAndRequestPermissions()
        StepSyncScheduler.schedulePeriodicSync(this)

        updateManager = AppUpdateManager(this)
        updateManager.checkForUpdates(this, silent = true)

        webView.loadUrl(appUrl)
    }

    private fun launchFileChooser(fileChooserParams: WebChromeClient.FileChooserParams?) {
        var takePictureIntent: Intent? = null

        try {
            val photoFile = createImageFile()
            cameraPhotoPath = photoFile.absolutePath
            val photoURI = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            cameraPhotoUri = photoURI

            takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Could not create image file for camera capture: ${e.localizedMessage}")
            cameraPhotoPath = null
            cameraPhotoUri = null
        }

        // File / Gallery picker intent
        val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"

            val acceptTypes = fileChooserParams?.acceptTypes
            if (!acceptTypes.isNullOrEmpty() && acceptTypes[0].isNotBlank()) {
                type = acceptTypes[0]
                if (acceptTypes.size > 1) {
                    putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes)
                }
            } else {
                type = "image/*"
            }

            if (fileChooserParams?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }

        val intentArray: Array<Intent> = if (takePictureIntent != null) {
            arrayOf(takePictureIntent)
        } else {
            emptyArray()
        }

        val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
            putExtra(Intent.EXTRA_TITLE, "Take Photo or Choose File")
            putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
        }

        fileChooserLauncher.launch(chooserIntent)
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
            ?: cacheDir
        return File.createTempFile(
            imageFileName,
            ".jpg",
            storageDir
        )
    }

    override fun onResume() {
        super.onResume()
        // If activity recognition permission is granted, perform a fresh fast step check
        if (hasActivityRecognitionPermission()) {
            jsBridge.requestStepSync()
        }
        if (::updateManager.isInitialized) {
            updateManager.checkForUpdates(this, silent = true)
        }
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
