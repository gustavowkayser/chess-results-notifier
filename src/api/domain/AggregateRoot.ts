import { DomainEvent } from './DomainEvent.ts';

export class AggregateRoot {
    protected apply(event: DomainEvent) {
        return event;
    }
}
