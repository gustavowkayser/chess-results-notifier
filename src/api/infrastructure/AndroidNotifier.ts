import { requireNativeMonitoring } from '../../native/NativeMonitoring.ts';
import { Notification } from '../domain/Notification.ts';
import { Notifier } from '../application/notifiers/Notifier.ts';

export class AndroidNotifier implements Notifier {
    async notify(notification: Notification): Promise<void> {
        requireNativeMonitoring().showNotification(
            notification.title,
            notification.body,
            notification.tag,
        );
    }
}
