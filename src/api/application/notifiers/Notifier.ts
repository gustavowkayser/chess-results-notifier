import { Notification } from '../../domain/Notification.ts';

export interface Notifier {
    notify(notification: Notification): Promise<void>;
}
