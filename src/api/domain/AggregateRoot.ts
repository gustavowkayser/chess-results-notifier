import { DomainEvent } from './DomainEvent.ts';

export abstract class AggregateRoot {
    private domainEvents: DomainEvent[] = [];
    private updatedAt: Date | null = null;

    protected constructor(public readonly id: string) {}

    public getEvents(): readonly DomainEvent[] {
        return this.domainEvents;
    }

    public pullEvents(): DomainEvent[] {
        const events = this.domainEvents;
        this.domainEvents = [];

        return events;
    }

    /**
     * When the aggregate last changed — the timestamp of its newest event, or
     * null when it has none. This is "last change", not "last checked": a
     * monitoring tick that sees nothing new writes no event by design.
     */
    public getUpdatedAt(): Date | null {
        return this.updatedAt;
    }

    protected apply(event: DomainEvent) {
        this.track(event);
        this.domainEvents.push(event);

        return event;
    }

    public replay(events: readonly DomainEvent[]) {
        for (const event of events) {
            this.track(event);
        }
    }

    // Both paths go through here so a rehydrated aggregate cannot disagree
    // with one that was mutated in this session.
    private track(event: DomainEvent) {
        this.mutate(event);
        this.updatedAt = event.occurredAt;
    }

    protected abstract mutate(event: DomainEvent): void;
}
