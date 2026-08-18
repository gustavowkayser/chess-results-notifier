import { DomainEvent } from '../DomainEvent.ts';

export class RoundPublished extends DomainEvent {
    public static readonly TYPE = 'RoundPublished';

    public constructor(
        aggregateId: string,
        public readonly round: number,
        occurredAt?: Date,
    ) {
        super(aggregateId, RoundPublished.TYPE, occurredAt);
    }

    public payload() {
        return { round: this.round };
    }
}
