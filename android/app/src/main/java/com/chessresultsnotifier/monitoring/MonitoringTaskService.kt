package com.chessresultsnotifier.monitoring

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs one tick of the TypeScript monitoring logic. [MonitoringService] starts
 * this on every interval; React Native boots a JS runtime if one is not already
 * up, so the task works with the app closed.
 */
class MonitoringTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
        val data = Arguments.createMap().apply {
            putDouble(
                "tickedAt",
                intent?.getLongExtra(EXTRA_TICKED_AT, 0L)?.toDouble() ?: 0.0,
            )
        }

        return HeadlessJsTaskConfig(
            TASK_NAME,
            data,
            TASK_TIMEOUT_MS,
            // Keep ticking while the app is in the foreground too, otherwise
            // monitoring silently stops whenever the user opens the app.
            true,
        )
    }

    companion object {
        /** Must match the name registered via AppRegistry in index.js. */
        const val TASK_NAME = "MonitoringTask"
        const val EXTRA_TICKED_AT = "tickedAt"

        private const val TASK_TIMEOUT_MS = 30_000L
    }
}
