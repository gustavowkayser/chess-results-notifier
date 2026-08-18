import { DomainEvent } from '../DomainEvent.ts';

/**
 * The user stopped tracking a tournament. The stream is not deleted: replaying
 * it still shows the tournament was once followed, and registering the same URL
 * again continues this stream rather than starting a new one.
 */
export class TournamentUnregistered extends DomainEvent {
    public static readonly TYPE = 'TournamentUnregistered';

    public constructor(aggregateId: string, occurredAt?: Date) {
        super(aggregateId, TournamentUnregistered.TYPE, occurredAt);
    }

    public payload() {
        return {};
    }
}
