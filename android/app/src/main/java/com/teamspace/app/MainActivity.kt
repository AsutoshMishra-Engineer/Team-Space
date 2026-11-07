package com.teamspace.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.teamspace.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    companion object {
        private const val TAG = "TeamSpaceMain"
        const val BASE_URL = "https://teamspace204.asutoshm359.workers.dev"
    }

    // File picker launcher for file uploads inside WebView
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            val results: Array<Uri>? = when {
                data?.dataString != null -> arrayOf(Uri.parse(data.dataString))
                data?.clipData != null -> {
                    val count = data.clipData!!.itemCount
                    val list = mutableListOf<Uri>()
                    for (i in 0 until count) {
                        data.clipData!!.getItemAt(i).uri?.let { list.add(it) }
                    }
                    list.toTypedArray()
                }
                else -> null
            }
            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    // Android 13+ Notification Permission Launcher
    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted.")
        } else {
            Toast.makeText(this, "Enable notifications in settings to receive team alerts.", Toast.LENGTH_LONG).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 1. Setup WebView settings
        setupWebView()

        // 2. Setup Swipe Refresh
        binding.swipeRefresh.setColorSchemeColors(ContextCompat.getColor(this, R.color.primary))
        binding.swipeRefresh.setOnRefreshListener {
            binding.webView.reload()
        }

        // 3. Setup Retry Button
        binding.btnRetry.setOnClickListener {
            binding.errorView.visibility = View.GONE
            binding.swipeRefresh.visibility = View.VISIBLE
            binding.webView.loadUrl(BASE_URL)
        }

        // 4. Handle Android Back Button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // 5. Request Android 13+ Notification Permission
        checkNotificationPermission()

        // 6. Fetch Native FCM Token & Cache
        fetchFcmToken()

        // 7. Load Target URL or Default Homepage
        val targetUrl = intent?.getStringExtra("target_url") ?: BASE_URL
        binding.webView.loadUrl(targetUrl)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty()) {
            binding.webView.loadUrl(targetUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString TeamSpaceNativeApp/1.0"
        }

        // JavaScript interface bridge
        binding.webView.addJavascriptInterface(WebAppInterface(this), "TeamSpaceNative")

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.progressBar.progress = newProgress
                } else {
                    binding.progressBar.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Internal app pages stay inside WebView
                if (url.contains("teamspace204.asutoshm359.workers.dev") || url.startsWith("file://")) {
                    return false
                }

                // External links (e.g. Google Search, external docs) open in system browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                binding.errorView.visibility = View.GONE
                binding.swipeRefresh.visibility = View.VISIBLE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    binding.swipeRefresh.visibility = View.GONE
                    binding.errorView.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun fetchFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d(TAG, "Device FCM Token ready: $token")
                val prefs = getSharedPreferences(MyFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(MyFirebaseMessagingService.KEY_FCM_TOKEN, token).apply()

                // Inject token into webview storage once loaded
                binding.webView.post {
                    val js = "window.__TEAMSPACE_NATIVE_FCM_TOKEN__ = '$token';"
                    binding.webView.evaluateJavascript(js, null)
                }
            } else {
                Log.w(TAG, "Fetching FCM registration token failed", task.exception)
            }
        }
    }

    class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun getNativeFcmToken(): String {
            val prefs = context.getSharedPreferences(MyFirebaseMessagingService.PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(MyFirebaseMessagingService.KEY_FCM_TOKEN, "") ?: ""
        }

        @JavascriptInterface
        fun isNativeApp(): Boolean = true
    }
}
