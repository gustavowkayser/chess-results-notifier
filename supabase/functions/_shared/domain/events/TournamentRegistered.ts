import { DomainEvent } from '../DomainEvent.ts';

/**
 * A user started following a tournament. Lives on that user's subscription
 * stream, so it carries no tournament facts: name and rounds belong to the
 * shared tournament stream, where one copy serves everyone.
 */
export class TournamentRegistered extends DomainEvent {
    public static readonly TYPE = 'TournamentRegistered';

    public constructor(
        aggregateId: string,
        // The subscription id is derived from it, but the projection reads the
        // URL out of the payload rather than unpicking an id that itself
        // contains colons.
        public readonly tournamentUrl: string,
        occurredAt?: Date,
    ) {
        super(aggregateId, TournamentRegistered.TYPE, occurredAt);
    }

    public payload() {
        return { tournamentUrl: this.tournamentUrl };
    }
}
