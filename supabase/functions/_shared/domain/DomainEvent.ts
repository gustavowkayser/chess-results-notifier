export abstract class DomainEvent {
    protected constructor(
        public readonly aggregateId: string,
        public readonly type: string,
        public readonly occurredAt: Date = new Date(),
    ) {}

    /**
     * The event-specific data, as it is written to the event store. Anything
     * needed to rebuild an aggregate has to be in here — the base fields above
     * are stored separately by the repository.
     */
    public abstract payload(): Record<string, unknown>;
}
