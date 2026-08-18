import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from './theme.ts';

const URL_PLACEHOLDER = 'https://s1.chess-results.com/tnr1477210.aspx';

export function TournamentInput({
    value,
    onChangeText,
    onSubmit,
    busy,
    error,
}: {
    value: string;
    onChangeText: (next: string) => void;
    onSubmit: () => void | Promise<void>;
    busy: boolean;
    error: string | null;
}) {
    const empty = value.trim().length === 0;

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={URL_PLACEHOLDER}
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    inputMode="url"
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                />
                <Pressable
                    style={[
                        styles.button,
                        (busy || empty) && styles.buttonDisabled,
                    ]}
                    onPress={onSubmit}
                    disabled={busy || empty}
                    testID="add-tournament"
                >
                    <Text style={styles.buttonLabel}>
                        {busy ? 'Adding…' : 'Add'}
                    </Text>
                </Pressable>
            </View>

            {error !== null && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        backgroundColor: theme.card,
        color: theme.text,
        fontSize: 14,
    },
    button: {
        justifyContent: 'center',
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: theme.accent,
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    buttonLabel: {
        color: '#fff',
        fontWeight: '600',
    },
    error: {
        marginTop: 8,
        color: theme.danger,
        fontSize: 13,
    },
});
