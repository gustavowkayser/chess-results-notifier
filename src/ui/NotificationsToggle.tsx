import { StyleSheet, Switch, Text, View } from 'react-native';
import { theme } from './theme.ts';

export function NotificationsToggle({
    enabled,
    onChange,
    busy = false,
}: {
    enabled: boolean;
    onChange: (next: boolean) => void | Promise<void>;
    busy?: boolean;
}) {
    return (
        <View style={styles.row}>
            <Text style={styles.label}>Enable Notifications</Text>
            <Switch
                value={enabled}
                onValueChange={onChange}
                disabled={busy}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.text}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    label: {
        color: theme.text,
        fontSize: 16,
        fontWeight: '500',
    },
});
