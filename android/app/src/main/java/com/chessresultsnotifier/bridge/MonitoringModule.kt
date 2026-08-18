package com.chessresultsnotifier.bridge

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.chessresultsnotifier.monitoring.MonitoringService
import com.facebook.fbreact.specs.NativeMonitoringSpec
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * JS-facing control surface for [MonitoringService]. Starting and stopping the
 * foreground service, and posting the notifications the TypeScript domain layer
 * decides on, both go through here.
 */
@ReactModule(name = NativeMonitoringSpec.NAME)
class MonitoringModule(
    reactContext: ReactApplicationContext
) : NativeMonitoringSpec(reactContext) {

    override fun startMonitoring(intervalSeconds: Double) {
        val intent = Intent(
            reactApplicationContext, MonitoringService::class.java
        ).apply {
            putExtra(
                MonitoringService.EXTRA_INTERVAL_SECONDS, intervalSeconds.toLong()
            )
        }

        ContextCompat.startForegroundService(reactApplicationContext, intent)
    }

    override fun stopMonitoring() {
        reactApplicationContext.stopService(
            Intent(reactApplicationContext, MonitoringService::class.java)
        )
    }

    override fun isMonitoring(promise: Promise) {
        promise.resolve(MonitoringService.isRunning)
    }

    // The permission is checked at runtime by catching SecurityException below,
    // which lint cannot see.
    @SuppressLint("MissingPermission")
    override fun showNotification(title: String, body: String, tag: String) {
        val context = reactApplicationContext

        createAlertChannel(context)

        val notification = NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            // Tagging by tournament means a later round replaces the previous
            // alert for that tournament instead of stacking up.
            NotificationManagerCompat.from(context)
                .notify(tag, ALERT_NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS was never granted; nothing to show.
            Log.w(TAG, "Notification permission missing", e)
        }
    }

    // The JS event emitter drives these; the native side keeps no per-listener
    // state, so there is nothing to do.
    override fun addListener(eventName: String) = Unit

    override fun removeListeners(count: Double) = Unit

    private fun createAlertChannel(context: Context) {
        // Deliberately separate from MonitoringService's IMPORTANCE_LOW channel:
        // that one is silent by design, which would make round alerts silent too.
        val channel = NotificationChannel(
            ALERT_CHANNEL_ID, "Round Alerts", NotificationManager.IMPORTANCE_DEFAULT
        )

        context.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "MonitoringModule"
        private const val ALERT_CHANNEL_ID = "tournament_alerts"
        private const val ALERT_NOTIFICATION_ID = 2001

        const val EVENT_TICK = "onMonitoringTick"
        const val EVENT_ERROR = "onMonitoringError"

        /**
         * Emits to JS without needing a module instance. Resolves the live
         * React context from the host, so it is a no-op when no JS runtime is
         * up — callers must not depend on delivery.
         */
        @JvmStatic
        fun emit(context: Context, eventName: String, params: WritableMap?) {
            val application = context.applicationContext as? ReactApplication
                ?: return

            application.reactHost.currentReactContext
                ?.emitDeviceEvent(eventName, params)
        }
    }
}
