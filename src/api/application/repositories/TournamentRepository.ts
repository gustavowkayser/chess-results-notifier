import { PublishedRound } from '../../domain/PublishedRound.ts';
import { TrackedTournament } from '../../domain/TrackedTournament.ts';

/**
 * Everything the app needs from the backend. The device holds no state of its
 * own any more, so this is the whole seam — and the whole thing a test has to
 * stand in for.
 */
export interface TournamentRepository {
    /** The tournaments this user is following, in the order they added them. */
    list(): Promise<TrackedTournament[]>;

    register(tournamentUrl: string): Promise<void>;

    unregister(tournamentUrl: string): Promise<void>;

    /**
     * Rounds published since this user was last notified, marked as notified in
     * the same call. Calling it twice in a row returns nothing the second time.
     */
    claimPendingRounds(): Promise<PublishedRound[]>;
}
