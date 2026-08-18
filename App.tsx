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
    View,
    useColorScheme,
} from 'react-native';
import {
    SafeAreaProvider,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MonitoringController } from './src/monitoring/MonitoringController';
import { tournamentService } from './src/api';

const SAMPLE_URL = 'https://s1.chess-results.com/tnr1234567.aspx?lan=1';
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
        const details = await tournamentService.registerTournament(SAMPLE_URL);
        append(`registered "${details.name}" at round ${details.currentRound}`);
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

            <View style={styles.buttons}>
                <Button label="Register sample" onPress={register} />
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
}: {
    label: string;
    onPress: () => void | Promise<void>;
}) {
    return (
        <Pressable style={styles.button} onPress={onPress}>
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
