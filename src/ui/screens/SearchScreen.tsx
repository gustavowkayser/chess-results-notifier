import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { isTournamentUrl, tournamentService } from '../../api';
import { theme } from '../theme.ts';

const PLACEHOLDER = 'Paste a chess-results link…';

/**
 * The subset of the navigation object this screen uses. Hand-written rather
 * than imported so the screen can be rendered in a test with a plain object.
 */
export interface SearchScreenNavigation {
    goBack: () => void;
}

export function SearchScreen({
    navigation,
}: {
    navigation: SearchScreenNavigation;
}) {
    const safeAreaInsets = useSafeAreaInsets();

    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const trimmed = query.trim();
    const isUrl = isTournamentUrl(trimmed);

    const register = async () => {
        if (!isUrl || busy) {
            return;
        }

        // Registering scrapes chess-results, so it is slow enough to need a
        // pending state and can fail on the network or a dead tournament.
        setBusy(true);
        setError(null);

        try {
            await tournamentService.registerTournament(trimmed);
            navigation.goBack();
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: safeAreaInsets.top + 12 },
            ]}
        >
            <View style={styles.header}>
                <Pressable
                    style={styles.back}
                    onPress={navigation.goBack}
                    testID="search-back"
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={8}
                >
                    <ArrowLeft size={20} color={theme.text} />
                </Pressable>

                <View style={styles.field}>
                    <Search size={18} color={theme.muted} />
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={setQuery}
                        placeholder={PLACEHOLDER}
                        placeholderTextColor={theme.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                        editable={!busy}
                        returnKeyType="go"
                        onSubmitEditing={register}
                    />
                    {trimmed.length > 0 && (
                        <Pressable
                            onPress={() => {
                                setQuery('');
                                setError(null);
                            }}
                            testID="search-clear"
                            accessibilityRole="button"
                            accessibilityLabel="Clear"
                            hitSlop={8}
                        >
                            <X size={16} color={theme.muted} />
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.results}>
                <Results
                    busy={busy}
                    error={error}
                    isUrl={isUrl}
                    onRegister={register}
                    query={trimmed}
                />
            </View>
        </View>
    );
}

function Results({
    busy,
    error,
    isUrl,
    onRegister,
    query,
}: {
    busy: boolean;
    error: string | null;
    isUrl: boolean;
    onRegister: () => void;
    query: string;
}) {
    if (busy) {
        return (
            <View style={styles.pending}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.hint}>Fetching tournament…</Text>
            </View>
        );
    }

    if (error !== null) {
        return <Text style={styles.error}>{error}</Text>;
    }

    if (isUrl) {
        return (
            <Pressable
                style={styles.result}
                onPress={onRegister}
                testID="register-tournament"
                accessibilityRole="button"
            >
                <Text style={styles.resultTitle}>Track this tournament</Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {query}
                </Text>
            </Pressable>
        );
    }

    // Not an error: player search is the unbuilt half of this screen, and a
    // name typed into it is the user reaching for it early.
    if (query.length > 0) {
        return (
            <Text style={styles.hint}>
                Player search is coming soon. For now, paste a chess-results
                tournament link.
            </Text>
        );
    }

    // Two Text nodes rather than one with a {'\n'} in it: an interpolated
    // newline turns the element's children into an array, and the test helper
    // that scrapes rendered copy only sees string children.
    return (
        <View style={styles.idle}>
            <Text style={styles.hint}>
                Paste a chess-results tournament link to start tracking it.
            </Text>
            <Text style={styles.example}>
                https://s1.chess-results.com/tnr1477210.aspx
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    back: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    field: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    input: {
        flex: 1,
        color: theme.text,
        fontSize: 15,
        paddingVertical: 10,
    },
    results: {
        flex: 1,
        marginTop: 20,
    },
    pending: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    result: {
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
    },
    resultTitle: {
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
    },
    resultSubtitle: {
        color: theme.muted,
        fontSize: 13,
        marginTop: 4,
    },
    idle: {
        gap: 8,
    },
    hint: {
        color: theme.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    example: {
        color: theme.border,
        fontSize: 13,
    },
    error: {
        color: theme.danger,
        fontSize: 14,
        lineHeight: 20,
    },
});
