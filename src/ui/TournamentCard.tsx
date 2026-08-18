import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.ts';

export interface TournamentCardModel {
    id: string;
    name: string;
    currentRound: number;
    totalRounds: number;
}

const roundLabel = ({ currentRound, totalRounds }: TournamentCardModel) => {
    // A tournament registered before its first pairings went up has no round
    // yet, and "Round 0 of 7" reads like an error.
    if (currentRound === 0) {
        return 'No pairings yet';
    }

    // Events written before totalRounds existed replay as 0, and a schedule can
    // in principle shrink. Either way "Round 5 of 0" is worse than saying less;
    // the next observed round restores the total.
    if (totalRounds < currentRound) {
        return `Round ${currentRound}`;
    }

    return `Round ${currentRound} of ${totalRounds}`;
};

export function TournamentCard({
    tournament,
    onUnregister,
}: {
    tournament: TournamentCardModel;
    onUnregister: (id: string) => void | Promise<void>;
}) {
    return (
        <View style={styles.card}>
            <View style={styles.details}>
                <Text style={styles.name} numberOfLines={2}>
                    {tournament.name}
                </Text>
                <Text style={styles.round}>{roundLabel(tournament)}</Text>
            </View>

            <Pressable
                style={styles.remove}
                onPress={() => onUnregister(tournament.id)}
                testID={`unregister-${tournament.id}`}
            >
                <Text style={styles.removeLabel}>Remove</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    details: {
        flex: 1,
    },
    name: {
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
    },
    round: {
        color: theme.muted,
        fontSize: 13,
        marginTop: 4,
    },
    remove: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.danger,
    },
    removeLabel: {
        color: theme.danger,
        fontSize: 13,
        fontWeight: '600',
    },
});
