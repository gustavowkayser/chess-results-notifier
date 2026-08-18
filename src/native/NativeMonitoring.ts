import { TurboModuleRegistry } from 'react-native';
import type { TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    /** Starts the foreground monitoring service, ticking every interval. */
    startMonitoring(intervalSeconds: number): void;

    stopMonitoring(): void;

    isMonitoring(): Promise<boolean>;

    /** Posts a user-visible notification. `tag` replaces an earlier one. */
    showNotification(title: string, body: string, tag: string): void;

    // Required by the event emitter plumbing on the native side.
    addListener(eventName: string): void;
    removeListeners(count: number): void;
}

// Deliberately get() rather than getEnforcing(): this module is imported from
// the app entry point, and getEnforcing would take the whole app down at
// startup wherever the native side is absent (iOS, Jest, a stale build).
const NativeMonitoring = TurboModuleRegistry.get<Spec>('Monitoring');

export default NativeMonitoring;

/** Use for calls that cannot do anything useful without the native module. */
export function requireNativeMonitoring(): Spec {
    if (NativeMonitoring == null) {
        throw new Error(
            'The Monitoring native module is unavailable. It is Android-only ' +
                'and requires a native rebuild after codegen.',
        );
    }

    return NativeMonitoring;
}
