package com.vxtmobile

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.*
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * GatewayForegroundService
 *
 * Keeps the VXT telemetry pipeline alive while the app is in the background.
 * Runs as a Foreground Service (FOREGROUND_SERVICE_TYPE_HEALTH) so Android
 * won't kill it while the screen is off.
 *
 * Start it from JS via NativeModules.GatewayServiceModule.start() or
 * from the notifee-based START_GATEWAY action.
 */
class GatewayForegroundService : Service() {

    companion object {
        const val CHANNEL_ID               = "vxt_gateway_channel"
        const val NOTIFICATION_ID          = 1001
        const val ACTION_START             = "com.vxtmobile.ACTION_START"
        const val ACTION_STOP              = "com.vxtmobile.ACTION_STOP"
        const val EXTRA_SAMPLE_INTERVAL_MS = "sampleIntervalMs"
        const val DEFAULT_SAMPLE_INTERVAL  = 60_000L
    }

    // Native Handler — runs on the main looper inside a foreground service,
    // so Android will NOT throttle or defer it when the screen is off.
    private val handler = Handler(Looper.getMainLooper())
    private var sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL

    private val sampleRunnable: Runnable = object : Runnable {
        override fun run() {
            sendEventToJS("GatewaySampleTick", null)
            handler.postDelayed(this, sampleIntervalMs)
        }
    }

    // ─── Service lifecycle ─────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
            else        -> {
                sampleIntervalMs = intent?.getLongExtra(EXTRA_SAMPLE_INTERVAL_MS, DEFAULT_SAMPLE_INTERVAL)
                    ?: DEFAULT_SAMPLE_INTERVAL
                startForegroundWithNotification()
            }
        }
        // Sticky — Android restarts the service if killed
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(sampleRunnable)
        super.onDestroy()
        // JS layer listens for this via the NativeEventEmitter
        sendEventToJS("GatewayServiceStopped", null)
    }

    // ─── Notification helpers ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "VXT Gateway",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description  = "VXT Telemetry Gateway – running in background"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val stopIntent = Intent(this, GatewayForegroundService::class.java)
            .setAction(ACTION_STOP)
        val stopPi = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VXT Gateway Active")
            .setContentText("Collecting health telemetry…")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPi)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        sendEventToJS("GatewayServiceStarted", null)
        // Start the native sampling ticker — fires reliably even when screen is off
        handler.removeCallbacks(sampleRunnable)
        handler.postDelayed(sampleRunnable, sampleIntervalMs)
    }

    // ─── Bridge helper ─────────────────────────────────────────────────────

    private fun sendEventToJS(eventName: String, data: Any?) {
        val reactApp = application as? MainApplication ?: return
        reactApp.reactNativeHost
            .reactInstanceManager
            .currentReactContext
            ?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, data)
    }
}
