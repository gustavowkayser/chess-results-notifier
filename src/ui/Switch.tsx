import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { theme } from './theme.ts';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 26;
const PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

/**
 * Replaces React Native's Switch, which renders the stock Material control on
 * Android and ignores most styling.
 */
export function Switch({
    value,
    onValueChange,
    disabled = false,
    testID,
}: {
    value: boolean;
    onValueChange: (next: boolean) => void;
    disabled?: boolean;
    testID?: string;
}) {
    const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: value ? 1 : 0,
            duration: 200,
            // The track colour animates, and colour cannot be driven on the UI
            // thread. Splitting this into two animations to native-drive the
            // thumb alone is not worth the complexity for a 200ms transition.
            useNativeDriver: false,
        }).start();
    }, [progress, value]);

    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled }}
            disabled={disabled}
            onPress={() => onValueChange(!value)}
            testID={testID}
        >
            <Animated.View
                style={[
                    styles.track,
                    disabled && styles.disabled,
                    {
                        backgroundColor: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [theme.switchTrackOff, theme.accent],
                        }),
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.thumb,
                        {
                            transform: [
                                {
                                    translateX: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, TRAVEL],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    track: {
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        padding: PADDING,
        justifyContent: 'center',
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        backgroundColor: '#ffffff',
    },
    disabled: {
        opacity: 0.5,
    },
});
