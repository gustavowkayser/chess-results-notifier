import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, Trash2 } from 'lucide-react-native';
import { ProgressRing } from './ProgressRing.tsx';
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

/**
 * The tournament's own domain, as the card's quiet second line. The full URL is
 * too long to sit under the name, but the mirror is worth showing since it is
 * what the link will open.
 */
const hostLabel = (url: string) => url.replace(/^https?:\/\//, '').split('/')[0];

export function TournamentCard({
    tournament,
    onUnregister,
    onOpen,
}: {
    tournament: TournamentCardModel;
    onUnregister: (id: string) => void | Promise<void>;
    onOpen: (id: string) => void | Promise<void>;
}) {
    const open = () => onOpen(tournament.id);

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                {/*
                 * The name is itself the call to action: the id is the
                 * tournament's chess-results address, so tapping the title goes
                 * to the page the card is summarising.
                 */}
                <Pressable
                    style={({ pressed }) => [
                        styles.nameArea,
                        pressed && styles.pressed,
                    ]}
                    onPress={open}
                    testID={`open-${tournament.id}`}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${tournament.name} on chess-results`}
                    hitSlop={4}
                >
                    <Text style={styles.name} numberOfLines={2}>
                        {tournament.name}
                    </Text>
                    <Text style={styles.host} numberOfLines={1}>
                        {hostLabel(tournament.id)}
                    </Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [
                        styles.remove,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => onUnregister(tournament.id)}
                    testID={`unregister-${tournament.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Stop tracking ${tournament.name}`}
                    hitSlop={8}
                >
                    <Trash2 size={16} color={theme.muted} />
                </Pressable>
            </View>

            <View style={styles.foot}>
                <ProgressRing
                    current={tournament.currentRound}
                    total={tournament.totalRounds}
                    label={roundLabel(tournament)}
                />

                <Text style={styles.meta} numberOfLines={2}>
                    {metaLabel(tournament)}
                </Text>

                {/*
                 * The same action as the title, given the weight it deserves.
                 * Lime marks it as the one thing on the card worth doing.
                 */}
                <Pressable
                    style={({ pressed }) => [
                        styles.cta,
                        pressed && styles.ctaPressed,
                    ]}
                    onPress={open}
                    testID={`open-button-${tournament.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${tournament.name} on chess-results`}
                    hitSlop={8}
                >
                    <ArrowUpRight size={20} color={theme.onAccent} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.card,
        borderRadius: theme.radius.card,
        padding: 18,
        marginBottom: 12,
    },
    head: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    nameArea: {
        flex: 1,
    },
    name: {
        ...theme.type.title,
        color: theme.text,
    },
    host: {
        ...theme.type.meta,
        fontSize: 12,
        color: theme.faint,
        marginTop: 3,
    },
    foot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 16,
    },
    meta: {
        ...theme.type.meta,
        flex: 1,
        color: theme.muted,
        lineHeight: 18,
    },
    // A bare 18px icon is an unmissable tap target on paper and a frustrating
    // one in the hand, so both pressables are padded out well past the glyph.
    remove: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.surface,
    },
    cta: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.pill,
        backgroundColor: theme.accent,
    },
    pressed: {
        opacity: 0.6,
    },
    ctaPressed: {
        opacity: 0.75,
        transform: [{ scale: 0.96 }],
    },
});
