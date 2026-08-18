import { DomainEvent } from '../domain/DomainEvent.ts';
import { RoundPublished } from '../domain/events/RoundPublished.ts';
import { TournamentRegistered } from '../domain/events/TournamentRegistered.ts';
import { TournamentUnregistered } from '../domain/events/TournamentUnregistered.ts';

export interface StoredEvent {
    aggregateId: string;
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
}

type EventFactory = (stored: StoredEvent) => DomainEvent;

// totalRounds was added after the first events were already written, so it is
// read defensively: an older payload replays as 0 rather than throwing.
const totalRoundsOf = (stored: StoredEvent): number =>
    (stored.payload.totalRounds as number | undefined) ?? 0;

const factories: Record<string, EventFactory> = {
    [TournamentRegistered.TYPE]: stored =>
        new TournamentRegistered(
            stored.aggregateId,
            stored.payload.tournamentUrl as string,
            stored.payload.name as string,
            stored.payload.currentRound as number,
            totalRoundsOf(stored),
            new Date(stored.occurredAt),
        ),
    [RoundPublished.TYPE]: stored =>
        new RoundPublished(
            stored.aggregateId,
            stored.payload.round as number,
            totalRoundsOf(stored),
            new Date(stored.occurredAt),
        ),
    [TournamentUnregistered.TYPE]: stored =>
        new TournamentUnregistered(
            stored.aggregateId,
            new Date(stored.occurredAt),
        ),
};

export class DomainEventSerializer {
    public static serialize(event: DomainEvent): StoredEvent {
        return {
            aggregateId: event.aggregateId,
            type: event.type,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload(),
        };
    }

    public static deserialize(stored: StoredEvent): DomainEvent {
        const factory = factories[stored.type];

        if (factory === undefined) {
            throw new Error(`Unknown domain event type "${stored.type}"`);
        }

        return factory(stored);
    }
}
