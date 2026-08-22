import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { theme } from './theme.ts';

const PLACEHOLDER = 'Add a tournament or search…';

/**
 * Looks like the search field it opens, but is a button: tapping it navigates
 * rather than raising a keyboard over the list.
 */
export function SearchBarButton({ onPress }: { onPress: () => void }) {
    return (
        <Pressable
            style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
            onPress={onPress}
            testID="open-search"
            accessibilityRole="button"
            accessibilityLabel={PLACEHOLDER}
        >
            <Search size={17} color={theme.muted} />
            <Text style={styles.placeholder}>{PLACEHOLDER}</Text>

            {/* The affordance the bar is really offering. Lime because adding a
                tournament is the one thing a new user has to do. */}
            <View style={styles.add}>
                <Plus size={18} color={theme.onAccent} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.card,
        borderRadius: theme.radius.pill,
        paddingLeft: 18,
        paddingRight: 6,
        paddingVertical: 6,
    },
    placeholder: {
        ...theme.type.body,
        flex: 1,
        color: theme.muted,
    },
    add: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.accent,
    },
    pressed: {
        opacity: 0.75,
    },
});
