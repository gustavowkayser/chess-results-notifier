import { monitoringService } from '../api/index.ts';

export interface MonitoringTaskData {
    /** Milliseconds since epoch, stamped by the native service on each tick. */
    tickedAt?: number;
}

/**
 * Runs once per tick of the Android MonitoringService. Registered under the
 * name "MonitoringTask" in index.js, which must match the task name used by
 * MonitoringTaskService.kt.
 */
export async function MonitoringTask(data: MonitoringTaskData): Promise<void> {
    console.log('MonitoringTask: tick', data.tickedAt);

    const notified = await monitoringService.checkAll();

    console.log(`MonitoringTask: sent ${notified} notification(s)`);
}
