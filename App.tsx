/**
 * Development harness for the Kotlin <-> TypeScript monitoring bridge.
 * The real tournament UI replaces this.
 *
 * @format
 */

import { useEffect, useState } from 'react';
import {
    DeviceEventEmitter,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    useColorScheme,
} from 'react-native';
import {
    SafeAreaProvider,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MonitoringController } from './src/monitoring/MonitoringController';
import { tournamentService } from './src/api';

const URL_PLACEHOLDER = 'https://s1.chess-results.com/tnr1477210.aspx';
const TICK_INTERVAL_SECONDS = 10;

function App() {
    const isDarkMode = useColorScheme() === 'dark';

    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            />
            <AppContent />
        </SafeAreaProvider>
    );
}

function AppContent() {
    const safeAreaInsets = useSafeAreaInsets();
    const [log, setLog] = useState<string[]>([]);
    const [monitoring, setMonitoring] = useState(false);
    const [url, setUrl] = useState('');
    const [registering, setRegistering] = useState(false);

    const append = (line: string) =>
        setLog(previous => [
            `${new Date().toLocaleTimeString()}  ${line}`,
            ...previous,
        ]);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener(
            'onMonitoringTick',
            () => append('native tick'),
        );

        MonitoringController.isMonitoring().then(setMonitoring);

        return () => subscription.remove();
    }, []);

    const register = async () => {
        const tournamentUrl = url.trim();

        if (tournamentUrl.length === 0 || registering) {
            return;
        }

        // Registering now scrapes chess-results, so it is slow enough to need a
        // pending state and can fail on either a malformed URL or the network.
        setRegistering(true);

        try {
            const details = await tournamentService.registerTournament(
                tournamentUrl,
            );

            append(
                `registered "${details.name}" at round ` +
                    `${details.currentRound} of ${details.totalRounds}`,
            );
            setUrl('');
        } catch (error) {
            append(`could not register: ${(error as Error).message}`);
        } finally {
            setRegistering(false);
        }
    };

    const start = async () => {
        await MonitoringController.start(TICK_INTERVAL_SECONDS);
        setMonitoring(true);
        append(`monitoring every ${TICK_INTERVAL_SECONDS}s`);
    };

    const stop = () => {
        MonitoringController.stop();
        setMonitoring(false);
        append('monitoring stopped');
    };

    return (
        <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
            <Text style={styles.title}>Monitoring bridge</Text>
            <Text style={styles.status}>
                {monitoring ? 'running' : 'stopped'}
            </Text>

            <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder={URL_PLACEHOLDER}
                placeholderTextColor="#9aa0a6"
                autoCapitalize="none"
                autoCorrect={false}
                inputMode="url"
                editable={!registering}
                returnKeyType="go"
                onSubmitEditing={register}
            />

            <View style={styles.buttons}>
                <Button
                    label={registering ? 'Registering…' : 'Register'}
                    onPress={register}
                    disabled={registering || url.trim().length === 0}
                />
                <Button label="Start" onPress={start} />
                <Button label="Stop" onPress={stop} />
            </View>

            <ScrollView style={styles.log}>
                {log.map((line, index) => (
                    <Text key={index} style={styles.logLine}>
                        {line}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
}

function Button({
    label,
    onPress,
    disabled = false,
}: {
    label: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
}) {
    return (
        <Pressable
            style={[styles.button, disabled && styles.buttonDisabled]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={styles.buttonLabel}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
    },
    status: {
        marginTop: 4,
        opacity: 0.6,
    },
    input: {
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#c4c7c5',
        borderRadius: 8,
        // The input carries its own background so it stays legible whatever the
        // surrounding theme does.
        backgroundColor: '#fff',
        color: '#111',
        fontSize: 14,
    },
    buttons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginVertical: 16,
    },
    button: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#3b6ea5',
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    buttonLabel: {
        color: '#fff',
        fontWeight: '500',
    },
    log: {
        flex: 1,
    },
    logLine: {
        fontFamily: 'monospace',
        fontSize: 12,
        paddingVertical: 2,
    },
});

export default App;
