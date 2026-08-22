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
import { ArrowLeft, ArrowUpRight, Link, Search, X } from 'lucide-react-native';
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
            style={[styles.container, { paddingTop: safeAreaInsets.top + 12 }]}
        >
            <Pressable
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
                onPress={navigation.goBack}
                testID="search-back"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
            >
                <ArrowLeft size={19} color={theme.text} />
            </Pressable>

            <Text style={styles.display}>Add a tournament to track</Text>

            <View style={styles.field}>
                <Search size={17} color={theme.muted} />
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={PLACEHOLDER}
                    placeholderTextColor={theme.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!busy}
                    returnKeyType="go"
                    onSubmitEditing={register}
                />
                {trimmed.length > 0 && (
                    <Pressable
                        style={styles.clear}
                        onPress={() => {
                            setQuery('');
                            setError(null);
                        }}
                        testID="search-clear"
                        accessibilityRole="button"
                        accessibilityLabel="Clear"
                        hitSlop={8}
                    >
                        <X size={14} color={theme.muted} />
                    </Pressable>
                )}
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
        return (
            <View style={styles.errorBox}>
                <Text style={styles.error}>{error}</Text>
            </View>
        );
    }

    if (isUrl) {
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.result,
                    pressed && styles.pressed,
                ]}
                onPress={onRegister}
                testID="register-tournament"
                accessibilityRole="button"
            >
                <View style={styles.resultIcon}>
                    <Link size={17} color={theme.accent} />
                </View>

                <View style={styles.resultText}>
                    <Text style={styles.resultTitle}>Track this tournament</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {query}
                    </Text>
                </View>

                <View style={styles.resultCta}>
                    <ArrowUpRight size={19} color={theme.onAccent} />
                </View>
            </Pressable>
        );
    }

    // Not an error: player search is the unbuilt half of this screen, and a
    // name typed into it is the user reaching for it early.
    if (query.length > 0) {
        return (
            <View style={styles.note}>
                <Text style={styles.hint}>
                    Player search is coming soon. For now, paste a chess-results
                    tournament link.
                </Text>
            </View>
        );
    }

    // Two Text nodes rather than one with a {'\n'} in it: an interpolated
    // newline turns the element's children into an array, and the test helper
    // that scrapes rendered copy only sees string children.
    return (
        <View style={styles.note}>
            <Text style={styles.hint}>
                Paste a chess-results tournament link to start tracking it.
            </Text>
            <Text style={styles.example}>
                https://s1.chess-results.com/tnrxxxxxxx.aspx
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
    },
    back: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    display: {
        ...theme.type.display,
        color: theme.text,
        marginTop: 24,
        marginBottom: 24,
        maxWidth: 280,
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.card,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 18,
    },
    input: {
        ...theme.type.body,
        flex: 1,
        color: theme.text,
        paddingVertical: 16,
    },
    clear: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    results: {
        flex: 1,
        marginTop: 20,
    },
    pending: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 4,
    },
    result: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: theme.card,
        borderRadius: theme.radius.card,
        padding: 16,
    },
    resultIcon: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    resultText: {
        flex: 1,
    },
    resultTitle: {
        ...theme.type.title,
        fontSize: 16,
        color: theme.text,
    },
    resultSubtitle: {
        ...theme.type.meta,
        fontSize: 12,
        color: theme.faint,
        marginTop: 3,
    },
    resultCta: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.accent,
    },
    note: {
        gap: 10,
        paddingHorizontal: 4,
    },
    hint: {
        ...theme.type.body,
        color: theme.muted,
        lineHeight: 22,
    },
    example: {
        ...theme.type.meta,
        fontFamily: theme.fonts.regular,
        color: theme.faint,
    },
    errorBox: {
        padding: 16,
        borderRadius: theme.radius.control,
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
    },
    error: {
        ...theme.type.body,
        color: theme.danger,
        lineHeight: 21,
    },
    pressed: {
        opacity: 0.7,
    },
});
