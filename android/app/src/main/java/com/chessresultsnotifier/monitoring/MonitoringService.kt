package com.chessresultsnotifier.monitoring

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.chessresultsnotifier.bridge.MonitoringModule
import com.facebook.react.bridge.Arguments
import kotlinx.coroutines.*

/**
 * Owns the monitoring schedule. It does no tournament work itself: each tick
 * hands off to [MonitoringTaskService], which runs the TypeScript domain logic.
 */
class MonitoringService : Service() {

    private val serviceScope = CoroutineScope(
        SupervisorJob() + Dispatchers.IO
    )

    private var monitoringJob: Job? = null

    override fun onCreate() {
        super.onCreate()

        createNotificationChannel()

        Log.d(TAG, "Monitoring service created")
    }

    private fun createNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID).setContentTitle("Chess Results Notifier")
            .setContentText("Monitorando torneios...").setSmallIcon(android.R.drawable.ic_popup_sync).build()
    }

    override fun onStartCommand(
        intent: Intent?, flags: Int, startId: Int
    ): Int {

        startForeground(
            NOTIFICATION_ID, createNotification()
        )

        isRunning = true

        val intervalSeconds = intent?.getLongExtra(
            EXTRA_INTERVAL_SECONDS, DEFAULT_INTERVAL_SECONDS
        ) ?: DEFAULT_INTERVAL_SECONDS

        startMonitoring(intervalSeconds.coerceAtLeast(MIN_INTERVAL_SECONDS))

        return START_STICKY
    }

    private fun startMonitoring(intervalSeconds: Long) {
        if (monitoringJob != null) {
            return
        }

        Log.d(TAG, "Monitoring every $intervalSeconds s")

        monitoringJob = serviceScope.launch {

            while (isActive) {

                Log.d(TAG, "Checking tournaments...")

                dispatchTick()

                delay(intervalSeconds * 1_000)
            }
        }
    }

    /**
     * Hands this tick to the JS side. Starting a service from a foreground
     * service is allowed, so this keeps working while the app is backgrounded.
     */
    private fun dispatchTick() {
        val tickedAt = System.currentTimeMillis()

        try {
            startService(
                Intent(this, MonitoringTaskService::class.java).apply {
                    putExtra(MonitoringTaskService.EXTRA_TICKED_AT, tickedAt)
                }
            )

            MonitoringModule.emit(
                this,
                MonitoringModule.EVENT_TICK,
                Arguments.createMap().apply {
                    putDouble("tickedAt", tickedAt.toDouble())
                },
            )
        } catch (e: IllegalStateException) {
            Log.e(TAG, "Could not dispatch monitoring tick", e)

            MonitoringModule.emit(
                this,
                MonitoringModule.EVENT_ERROR,
                Arguments.createMap().apply {
                    putString("message", e.message ?: "Could not dispatch tick")
                },
            )
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Monitoring service destroyed")

        isRunning = false

        monitoringJob?.cancel()
        serviceScope.cancel()

        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Tournament Monitoring", NotificationManager.IMPORTANCE_LOW
        )

        val manager = getSystemService(
            NotificationManager::class.java
        )

        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val TAG = "MonitoringService"
        private const val CHANNEL_ID = "tournament_monitoring"
        private const val NOTIFICATION_ID = 1001

        private const val DEFAULT_INTERVAL_SECONDS = 60L
        private const val MIN_INTERVAL_SECONDS = 5L

        const val EXTRA_INTERVAL_SECONDS = "intervalSeconds"

        @Volatile
        var isRunning: Boolean = false
            private set
    }
}
