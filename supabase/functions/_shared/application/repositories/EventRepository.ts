import { AggregateRoot } from '../../domain/AggregateRoot.ts';
import { DomainEvent } from '../../domain/DomainEvent.ts';

export interface EventRepository {
    /** Appends whatever the aggregate has pulled. Appending nothing is fine. */
    save(aggregate: AggregateRoot): Promise<void>;

    /**
     * One stream, in append order. Two kinds of stream now share the table, and
     * a subscription id embeds a URL, so the type is part of the address rather
     * than something to infer.
     */
    load(
        aggregateType: string,
        aggregateId: string,
    ): Promise<DomainEvent[]>;
}
