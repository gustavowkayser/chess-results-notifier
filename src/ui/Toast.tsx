import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from './theme.ts';

const VISIBLE_MS = 2600;
const FADE_MS = 180;

export type ToastTone = 'default' | 'error';

export type ShowToast = (message: string, tone?: ToastTone) => void;

interface ToastModel {
    /** Distinguishes two toasts carrying the same words, so the second one
     *  replays the entry animation instead of sitting there unchanged. */
    id: number;
    message: string;
    tone: ToastTone;
}

/**
 * A no-op by default rather than a throw: every screen has to render on its own
 * in a test, and a screen that merely announces something should not need the
 * provider mounted to do it.
 */
const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

/**
 * Holds the one toast the app is currently showing. Mounted above the navigator
 * so a message raised just before `goBack` survives the transition and lands on
 * the screen the user actually ends up looking at.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<ToastModel | null>(null);
    const nextId = useRef(0);

    const show = useCallback<ShowToast>((message, tone = 'default') => {
        setToast({ id: nextId.current++, message, tone });
    }, []);

    return (
        <ToastContext.Provider value={show}>
            {children}

            {toast !== null && (
                <Toast
                    key={toast.id}
                    toast={toast}
                    onHidden={() =>
                        // Guarded on the id: a toast that was replaced while
                        // fading out must not clear the one that replaced it.
                        setToast(current =>
                            current?.id === toast.id ? null : current,
                        )
                    }
                />
            )}
        </ToastContext.Provider>
    );
}

function Toast({
    toast,
    onHidden,
}: {
    toast: ToastModel;
    onHidden: () => void;
}) {
    const safeAreaInsets = useSafeAreaInsets();
    const progress = useRef(new Animated.Value(0)).current;

    // Held in a ref so dismissing by tap can cancel the pending auto-dismiss
    // rather than racing it into a second `onHidden`.
    const hidden = useRef(false);

    const hide = useCallback(() => {
        if (hidden.current) {
            return;
        }

        hidden.current = true;

        Animated.timing(progress, {
            toValue: 0,
            duration: FADE_MS,
            useNativeDriver: true,
        }).start(onHidden);
    }, [onHidden, progress]);

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration: FADE_MS,
            useNativeDriver: true,
        }).start();

        const timer = setTimeout(hide, VISIBLE_MS);

        return () => clearTimeout(timer);
    }, [hide, progress]);

    return (
        <Animated.View
            style={[
                styles.container,
                { bottom: safeAreaInsets.bottom + 24 },
                {
                    opacity: progress,
                    transform: [
                        {
                            translateY: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                            }),
                        },
                    ],
                },
            ]}
            pointerEvents="box-none"
        >
            <Pressable
                style={({ pressed }) => [
                    styles.toast,
                    pressed && styles.pressed,
                ]}
                onPress={hide}
                testID="toast"
                accessibilityRole="alert"
                accessibilityLabel={toast.message}
            >
                {/* The same lime dot the header uses for LIVE, so a toast reads
                    as the app confirming something rather than as a warning. */}
                <View
                    style={[
                        styles.dot,
                        toast.tone === 'error' && styles.dotError,
                    ]}
                />
                <Text style={styles.message} numberOfLines={2}>
                    {toast.message}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: '100%',
        paddingLeft: 16,
        paddingRight: 18,
        paddingVertical: 13,
        borderRadius: theme.radius.pill,
        // A step above card: the toast floats over screens that are themselves
        // black-on-black, so it needs its own edge without a border.
        backgroundColor: theme.surface,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: theme.accent,
    },
    dotError: {
        backgroundColor: theme.danger,
    },
    message: {
        ...theme.type.body,
        flexShrink: 1,
        fontSize: 14,
        color: theme.text,
    },
    pressed: {
        opacity: 0.8,
    },
});
