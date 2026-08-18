import { DomainEvent } from '../DomainEvent.ts';

export class RoundPublished extends DomainEvent {
    public static readonly TYPE = 'RoundPublished';

    public constructor(
        aggregateId: string,
        public readonly round: number,
        // Carried alongside the round so an organiser revising the schedule is
        // reflected in replayed state, rather than frozen at registration.
        public readonly totalRounds: number,
        occurredAt?: Date,
    ) {
        super(aggregateId, RoundPublished.TYPE, occurredAt);
    }

    public payload() {
        return { round: this.round, totalRounds: this.totalRounds };
    }
}
