import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from './theme.ts';

const SIZE = 54;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How far through its rounds a tournament is, as a ring around the round
 * number. `total` of 0 means the schedule is unknown, which is not the same as
 * zero progress: the ring stays empty rather than claiming a fraction it
 * cannot know, and the number still reads.
 */
export function ProgressRing({
    current,
    total,
    label,
}: {
    current: number;
    total: number;
    label: string;
}) {
    const fraction = total > 0 ? Math.min(current / total, 1) : 0;

    return (
        <View
            style={styles.ring}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={label}
        >
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    stroke={theme.accentTrack}
                    strokeWidth={STROKE}
                    fill="none"
                />
                {fraction > 0 && (
                    <Circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        stroke={theme.accent}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                        // Dashes start at 3 o'clock; the arc has to begin at the
                        // top to read as progress rather than as decoration.
                        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    />
                )}
            </Svg>

            <Text style={styles.value}>{current > 0 ? current : '–'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    ring: {
        width: SIZE,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontFamily: theme.fonts.semibold,
        fontSize: 18,
        color: theme.text,
        letterSpacing: -0.5,
    },
});
