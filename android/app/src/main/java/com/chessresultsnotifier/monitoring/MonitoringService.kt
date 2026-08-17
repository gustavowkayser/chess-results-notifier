package com.chessresultsnotifier.monitoring

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*

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

        startMonitoring()

        return START_STICKY
    }

    private fun startMonitoring() {
        if (monitoringJob != null) {
            return
        }

        monitoringJob = serviceScope.launch {

            while (isActive) {

                Log.d(TAG, "Checking tournaments...")

                delay(60_000)
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Monitoring service destroyed")

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
    }
}