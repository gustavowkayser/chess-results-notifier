import { Pressable, StyleSheet, Text } from 'react-native';
import { Search } from 'lucide-react-native';
import { theme } from './theme.ts';

const PLACEHOLDER = 'Add a tournament or search…';

/**
 * Looks like the search field it opens, but is a button: tapping it navigates
 * rather than raising a keyboard over the list.
 */
export function SearchBarButton({ onPress }: { onPress: () => void }) {
    return (
        <Pressable
            style={styles.bar}
            onPress={onPress}
            testID="open-search"
            accessibilityRole="button"
            accessibilityLabel={PLACEHOLDER}
        >
            <Search size={18} color={theme.muted} />
            <Text style={styles.placeholder}>{PLACEHOLDER}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgb(0 0 0 / 0)',
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 99,
        paddingHorizontal: 14,
        paddingVertical: 16,
    },
    placeholder: {
        color: theme.muted,
        fontSize: 15,
    },
});
