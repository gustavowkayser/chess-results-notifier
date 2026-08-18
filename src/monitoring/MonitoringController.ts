import { PermissionsAndroid, Platform } from 'react-native';
import NativeMonitoring, {
    requireNativeMonitoring,
} from '../native/NativeMonitoring.ts';

const DEFAULT_INTERVAL_SECONDS = 60;

export class MonitoringController {
    static isAvailable(): boolean {
        return NativeMonitoring != null;
    }

    /**
     * From Android 13 the foreground notification is hidden and
     * showNotification() is a no-op without this grant, so ask before starting.
     */
    static async requestNotificationPermission(): Promise<boolean> {
        if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
            return true;
        }

        const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );

        return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    static async start(
        intervalSeconds: number = DEFAULT_INTERVAL_SECONDS,
    ): Promise<void> {
        await MonitoringController.requestNotificationPermission();

        requireNativeMonitoring().startMonitoring(intervalSeconds);
    }

    static stop(): void {
        requireNativeMonitoring().stopMonitoring();
    }

    /** Safe to call anywhere: reports false when the native side is absent. */
    static isMonitoring(): Promise<boolean> {
        return NativeMonitoring?.isMonitoring() ?? Promise.resolve(false);
    }
}
