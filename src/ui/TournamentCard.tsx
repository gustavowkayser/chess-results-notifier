import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { formatRelativeTime } from './relativeTime.ts';
import { theme } from './theme.ts';

export interface TournamentCardModel {
    id: string;
    name: string;
    currentRound: number;
    totalRounds: number;
    updatedAt: Date | null;
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

/**
 * The round and when it went up. The timestamp is the aggregate's last change,
 * so it sits next to the round it describes rather than reading as a freshness
 * check on the app.
 */
const metaLabel = (tournament: TournamentCardModel) => {
    const round = roundLabel(tournament);

    if (tournament.updatedAt === null) {
        return round;
    }

    return `${round} · ${formatRelativeTime(tournament.updatedAt)}`;
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
                <Text style={styles.meta}>{metaLabel(tournament)}</Text>
            </View>

            <Pressable
                style={styles.remove}
                onPress={() => onUnregister(tournament.id)}
                testID={`unregister-${tournament.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Stop tracking ${tournament.name}`}
                hitSlop={8}
            >
                <Trash2 size={18} color={theme.danger} />
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
    meta: {
        color: theme.muted,
        fontSize: 13,
        marginTop: 4,
    },
    // A bare 18px icon is an unmissable tap target on paper and a frustrating
    // one in the hand, so the pressable is padded out to 40.
    remove: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
    },
});
