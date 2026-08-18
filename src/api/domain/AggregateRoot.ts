import { DomainEvent } from './DomainEvent.ts';

export abstract class AggregateRoot {
    private domainEvents: DomainEvent[] = [];

    protected constructor(public readonly id: string) {}

    public getEvents(): readonly DomainEvent[] {
        return this.domainEvents;
    }

    public pullEvents(): DomainEvent[] {
        const events = this.domainEvents;
        this.domainEvents = [];

        return events;
    }

    protected apply(event: DomainEvent) {
        this.mutate(event);
        this.domainEvents.push(event);

        return event;
    }

    public replay(events: readonly DomainEvent[]) {
        for (const event of events) {
            this.mutate(event);
        }
    }

    protected abstract mutate(event: DomainEvent): void;
}
