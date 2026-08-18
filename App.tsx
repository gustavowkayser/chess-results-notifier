/**
 * @format
 */

import { useCallback, useEffect, useState } from 'react';
import {
    DeviceEventEmitter,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaProvider,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MonitoringController } from './src/monitoring/MonitoringController';
import { tournamentService } from './src/api';
import { NotificationsToggle } from './src/ui/NotificationsToggle';
import { TournamentInput } from './src/ui/TournamentInput';
import {
    TournamentCard,
    TournamentCardModel,
} from './src/ui/TournamentCard';
import { theme } from './src/ui/theme';

const TICK_INTERVAL_SECONDS = 60;

function App() {
    return (
        <SafeAreaProvider>
            {/* No backgroundColor: RN 0.87 dropped it for edge-to-edge. The
                container paints behind the status bar via the safe-area inset. */}
            <StatusBar barStyle="light-content" />
            <AppContent />
        </SafeAreaProvider>
    );
}

function AppContent() {
    const safeAreaInsets = useSafeAreaInsets();

    const [tournaments, setTournaments] = useState<TournamentCardModel[]>([]);
    const [monitoring, setMonitoring] = useState(false);
    const [togglingMonitoring, setTogglingMonitoring] = useState(false);
    const [url, setUrl] = useState('');
    const [registering, setRegistering] = useState(false);
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
                };
            }),
        );
    }, []);

    useEffect(() => {
        // A tick may have advanced a round, so the cards are refreshed rather
        // than left stale until the app restarts.
        const subscription = DeviceEventEmitter.addListener(
            'onMonitoringTick',
            () => {
                refresh();
            },
        );

        MonitoringController.isMonitoring().then(setMonitoring);
        refresh();

        return () => subscription.remove();
    }, [refresh]);

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

    const register = async () => {
        const tournamentUrl = url.trim();

        if (tournamentUrl.length === 0 || registering) {
            return;
        }

        // Registering scrapes chess-results, so it is slow enough to need a
        // pending state and can fail on a bad URL or on the network.
        setRegistering(true);
        setError(null);

        try {
            await tournamentService.registerTournament(tournamentUrl);
            setUrl('');
            await refresh();
        } catch (caught) {
            setError((caught as Error).message);
        } finally {
            setRegistering(false);
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

            <NotificationsToggle
                enabled={monitoring}
                onChange={toggleMonitoring}
                busy={togglingMonitoring}
            />

            <TournamentInput
                value={url}
                onChangeText={setUrl}
                onSubmit={register}
                busy={registering}
                error={error}
            />

            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
            >
                {tournaments.length === 0 ? (
                    <Text style={styles.empty}>
                        No tournaments yet. Paste a chess-results link above to
                        start tracking one.
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
    list: {
        flex: 1,
        marginTop: 20,
    },
    listContent: {
        paddingBottom: 24,
    },
    empty: {
        color: theme.muted,
        fontSize: 14,
        lineHeight: 20,
    },
});

export default App;
