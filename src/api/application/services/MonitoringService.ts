import { Notification } from '../../domain/Notification.ts';
import { Notifier } from '../notifiers/Notifier.ts';
import { PublishedRound } from '../../domain/PublishedRound.ts';
import { TournamentRepository } from '../repositories/TournamentRepository.ts';

/**
 * One tick of the monitoring service.
 *
 * The device no longer decides whether a round has moved on — the scheduled
 * refresh does that once for everyone. What is left here is delivery: ask for
 * the rounds this user has not seen, and put them on screen.
 */
export class MonitoringService {
    constructor(
        private readonly tournaments: TournamentRepository,
        private readonly notifier: Notifier,
    ) {}

    /** Returns how many notifications were shown. */
    async deliverPending(): Promise<number> {
        // Claiming before showing is deliberate. Two ticks can overlap — the
        // foreground service and a cold headless task — and announcing a round
        // twice is worse than the rare case of losing one to a failed native
        // call, which the warning below at least records.
        const rounds = await this.tournaments.claimPendingRounds();

        const shown = await Promise.all(
            rounds.map(round =>
                this.notifier
                    .notify(notificationFor(round))
                    .then(() => true)
                    .catch(error => {
                        console.warn(
                            `Failed to notify about ${round.tournamentUrl}`,
                            error,
                        );

                        return false;
                    }),
            ),
        );

        return shown.filter(Boolean).length;
    }
}

const notificationFor = (round: PublishedRound): Notification =>
    new Notification(
        round.name,
        `Round ${round.currentRound} of ${round.totalRounds} pairings are out`,
        // The URL as tag: a later round replaces the previous notification for
        // the same tournament rather than stacking up.
        round.tournamentUrl,
    );
