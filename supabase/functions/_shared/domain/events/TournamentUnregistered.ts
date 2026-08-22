import { DomainEvent } from '../DomainEvent.ts';

/**
 * The user stopped following a tournament. The stream is not deleted: replaying
 * it still shows the tournament was once followed, and registering the same URL
 * again continues this stream rather than starting a new one.
 *
 * The shared tournament stream is untouched — other people may still be
 * following it, and it keeps being refreshed for them.
 */
export class TournamentUnregistered extends DomainEvent {
    public static readonly TYPE = 'TournamentUnregistered';

    public constructor(
        aggregateId: string,
        public readonly tournamentUrl: string,
        occurredAt?: Date,
    ) {
        super(aggregateId, TournamentUnregistered.TYPE, occurredAt);
    }

    public payload() {
        return { tournamentUrl: this.tournamentUrl };
    }
}
