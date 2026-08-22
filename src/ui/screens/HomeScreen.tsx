import { useCallback, useEffect, useRef, useState } from 'react';
import {
    DeviceEventEmitter,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Crown } from 'lucide-react-native';
import { MonitoringController } from '../../monitoring/MonitoringController.ts';
import { tournamentService } from '../../api';
import { SearchBarButton } from '../SearchBarButton.tsx';
import { Switch } from '../Switch.tsx';
import { useToast } from '../Toast.tsx';
import { TournamentCard, TournamentCardModel } from '../TournamentCard.tsx';
import { theme } from '../theme.ts';

const TICK_INTERVAL_SECONDS = 60;

/**
 * The subset of the navigation object this screen uses. Hand-written rather
 * than imported so the screen can be rendered in a test with a plain object.
 */
export interface HomeScreenNavigation {
    navigate: (route: 'Search') => void;
    addListener: (event: 'focus', listener: () => void) => () => void;
}

export function HomeScreen({
    navigation,
}: {
    navigation: HomeScreenNavigation;
}) {
    const safeAreaInsets = useSafeAreaInsets();
    const showToast = useToast();

    const [tournaments, setTournaments] = useState<TournamentCardModel[]>([]);
    const [monitoring, setMonitoring] = useState(false);
    const [togglingMonitoring, setTogglingMonitoring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cards taken off screen ahead of the server. A refresh already in flight
    // — or the tick a minute later — would otherwise read a list the delete has
    // not landed on yet and put the card straight back.
    const pendingRemovals = useRef(new Set<string>());

    const refresh = useCallback(async () => {
        // The list comes over the network now, so it can fail where reading the
        // local database could not. Failing quietly would leave the last good
        // list on screen with no hint that it had stopped being updated.
        try {
            const tracked = await tournamentService.listTournaments();

            setTournaments(
                tracked
                    .filter(
                        tournament =>
                            !pendingRemovals.current.has(tournament.url),
                    )
                    .map(tournament => ({
                        id: tournament.url,
                        name: tournament.name,
                        currentRound: tournament.currentRound,
                        totalRounds: tournament.totalRounds,
                        updatedAt: tournament.updatedAt,
                    })),
            );
        } catch (caught) {
            setError((caught as Error).message);
        }
    }, []);

    useEffect(() => {
        // A tick may have advanced a round, so the cards are refreshed rather
        // than left stale until the app restarts.
        const tick = DeviceEventEmitter.addListener('onMonitoringTick', () => {
            refresh();
        });

        // Registering happens on the search screen, so coming back here is the
        // only moment a new tournament can appear.
        const unsubscribeFocus = navigation.addListener('focus', () => {
            refresh();
        });

        MonitoringController.isMonitoring().then(setMonitoring);
        refresh();

        return () => {
            tick.remove();
            unsubscribeFocus();
        };
    }, [navigation, refresh]);

    const toggleMonitoring = async (next: boolean) => {
        setTogglingMonitoring(true);
        setError(null);

        try {
            if (!next) {
                MonitoringController.stop();
                setMonitoring(false);

                return;
            }

            const started = await MonitoringController.start(
                TICK_INTERVAL_SECONDS,
            );

            setMonitoring(started);

            if (!started) {
                setError(
                    'Notifications are blocked for this app. Enable them in ' +
                        'Android settings to get round alerts.',
                );
            }
        } catch (caught) {
            setMonitoring(false);
            setError((caught as Error).message);
        } finally {
            setTogglingMonitoring(false);
        }
    };

    // The card id is the canonical chess-results address, so opening it needs
    // nothing beyond handing it to the browser. openURL rejects when no app
    // will take the link, which is worth surfacing rather than swallowing.
    const openTournamentPage = async (id: string) => {
        setError(null);

        try {
            await Linking.openURL(id);
        } catch {
            setError(
                'Could not open the chess-results page for this tournament.',
            );
        }
    };

    // The card leaves as soon as the tap lands, rather than a couple of
    // seconds later when the delete comes back. Nothing on the card could say
    // it was working, so the wait read as a tap that had missed.
    const unregister = async (id: string) => {
        setError(null);

        pendingRemovals.current.add(id);
        setTournaments(current =>
            current.filter(tournament => tournament.id !== id),
        );

        try {
            await tournamentService.unregisterTournament(id);
            pendingRemovals.current.delete(id);
            showToast('Tournament removed');
        } catch (caught) {
            pendingRemovals.current.delete(id);
            setError((caught as Error).message);
            showToast('Could not remove tournament', 'error');

            // The tournament is still tracked, so its card belongs back on
            // screen. Re-reading the list rather than restoring the model kept
            // aside picks up anything else that moved in the meantime.
            await refresh();
        }
    };

    return (
        <View
            style={[styles.container, { paddingTop: safeAreaInsets.top + 12 }]}
        >
            <View style={styles.header}>
                <View style={styles.brand}>
                    <View style={styles.mark}>
                        <Crown size={16} color={theme.accent} />
                    </View>
                    <Text style={styles.wordmark}>CHESSNOTIFY</Text>
                </View>

                {/* Whether the app is actually watching, stated where the eye
                    lands first. The toggle that changes it is below. */}
                <View style={styles.status}>
                    <View
                        style={[
                            styles.statusDot,
                            !monitoring && styles.statusDotOff,
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {monitoring ? 'LIVE' : 'PAUSED'}
                    </Text>
                </View>
            </View>

            <Text style={styles.display}>Keep track of your tournaments</Text>

            <SearchBarButton onPress={() => navigation.navigate('Search')} />

            <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                    <Bell
                        size={17}
                        color={monitoring ? theme.accent : theme.muted}
                    />
                </View>
                <View style={styles.toggleLabel}>
                    <Text style={styles.toggleText}>Round alerts</Text>
                    <Text style={styles.toggleHint}>
                        {monitoring
                            ? 'Checking every minute'
                            : 'Not checking for new rounds'}
                    </Text>
                </View>
                <Switch
                    value={monitoring}
                    onValueChange={toggleMonitoring}
                    disabled={togglingMonitoring}
                    testID="notifications-switch"
                />
            </View>

            {error !== null && (
                <View style={styles.errorBox}>
                    <Text style={styles.error}>{error}</Text>
                </View>
            )}

            <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>TOURNAMENTS</Text>
                <View style={styles.count}>
                    <Text style={styles.countText}>{tournaments.length}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            >
                {tournaments.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
                        <Text style={styles.empty}>
                            Tap the bar above and paste a chess-results link to
                            get an alert the moment a new round goes up.
                        </Text>
                    </View>
                ) : (
                    tournaments.map(tournament => (
                        <TournamentCard
                            key={tournament.id}
                            tournament={tournament}
                            onUnregister={unregister}
                            onOpen={openTournamentPage}
                        />
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mark: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    wordmark: {
        ...theme.type.label,
        color: theme.muted,
    },
    status: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.accent,
    },
    statusDotOff: {
        backgroundColor: theme.faint,
    },
    display: {
        ...theme.type.display,
        color: theme.text,
        marginTop: 28,
        marginBottom: 24,
        // Holds the headline to two lines on a phone, which is the proportion
        // the reference layouts are built on.
        maxWidth: 280,
    },
    statusText: {
        ...theme.type.label,
        fontSize: 10,
        color: theme.text,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: theme.card,
        borderRadius: theme.radius.card,
        padding: 16,
        marginTop: 12,
    },
    toggleIcon: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    toggleLabel: {
        flex: 1,
    },
    toggleText: {
        ...theme.type.body,
        fontFamily: theme.fonts.medium,
        color: theme.text,
    },
    toggleHint: {
        ...theme.type.meta,
        fontSize: 12,
        color: theme.muted,
        marginTop: 2,
    },
    sectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 28,
        marginBottom: 14,
    },
    sectionLabel: {
        ...theme.type.label,
        color: theme.muted,
    },
    count: {
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 7,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    countText: {
        fontFamily: theme.fonts.semibold,
        fontSize: 11,
        color: theme.muted,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 32,
    },
    emptyCard: {
        backgroundColor: theme.card,
        borderRadius: theme.radius.card,
        padding: 20,
    },
    emptyTitle: {
        ...theme.type.title,
        color: theme.text,
        marginBottom: 6,
    },
    empty: {
        ...theme.type.meta,
        color: theme.muted,
        lineHeight: 20,
    },
    errorBox: {
        marginTop: 12,
        padding: 14,
        borderRadius: theme.radius.control,
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
    },
    error: {
        ...theme.type.meta,
        color: theme.danger,
        lineHeight: 18,
    },
});
