import { useCallback, useEffect, useState } from 'react';
import {
    DeviceEventEmitter,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { MonitoringController } from '../../monitoring/MonitoringController.ts';
import { tournamentService } from '../../api';
import { SearchBarButton } from '../SearchBarButton.tsx';
import { Switch } from '../Switch.tsx';
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

    const [tournaments, setTournaments] = useState<TournamentCardModel[]>([]);
    const [monitoring, setMonitoring] = useState(false);
    const [togglingMonitoring, setTogglingMonitoring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const tracked = await tournamentService.listTournaments();

        setTournaments(
            tracked.map(tournament => {
                const details = tournament.getDetails();

                return {
                    id: tournament.id,
                    name: details.name,
                    currentRound: details.currentRound,
                    totalRounds: details.totalRounds,
                    updatedAt: tournament.getUpdatedAt(),
                };
            }),
        );
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

    const unregister = async (id: string) => {
        setError(null);

        try {
            await tournamentService.unregisterTournament(id);
            await refresh();
        } catch (caught) {
            setError((caught as Error).message);
        }
    };

    return (
        <View
            style={[styles.container, { paddingTop: safeAreaInsets.top + 16 }]}
        >
            <Text style={styles.title}>Chess Results Notifier</Text>

            <SearchBarButton onPress={() => navigation.navigate('Search')} />

            <View style={styles.toggleRow}>
                <View style={styles.toggleLabel}>
                    <Bell size={18} color={theme.muted} />
                    <Text style={styles.toggleText}>Notifications</Text>
                </View>
                <Switch
                    value={monitoring}
                    onValueChange={toggleMonitoring}
                    disabled={togglingMonitoring}
                    testID="notifications-switch"
                />
            </View>

            {error !== null && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.sectionLabel}>
                TRACKED · {tournaments.length}
            </Text>

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
            >
                {tournaments.length === 0 ? (
                    <Text style={styles.empty}>
                        No tournaments yet. Tap the bar above to add a
                        chess-results link.
                    </Text>
                ) : (
                    tournaments.map(tournament => (
                        <TournamentCard
                            key={tournament.id}
                            tournament={tournament}
                            onUnregister={unregister}
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
        padding: 16,
        backgroundColor: theme.background,
    },
    title: {
        color: theme.text,
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 12,
    },
    toggleLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    toggleText: {
        color: theme.text,
        fontSize: 16,
        fontWeight: '500',
    },
    sectionLabel: {
        color: theme.muted,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 24,
    },
    list: {
        flex: 1,
        marginTop: 12,
    },
    listContent: {
        paddingBottom: 24,
    },
    empty: {
        color: theme.muted,
        fontSize: 14,
        lineHeight: 20,
    },
    error: {
        marginTop: 12,
        color: theme.danger,
        fontSize: 13,
        lineHeight: 18,
    },
});
