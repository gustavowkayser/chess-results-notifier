import { AggregateRoot } from '../../domain/AggregateRoot.ts';
import { DomainEvent } from '../../domain/DomainEvent.ts';

export interface EventRepository {
    save(aggregate: AggregateRoot): Promise<void>;
    load(aggregateId: string): Promise<DomainEvent[]>;
    listAggregateIds(): Promise<string[]>;
}
