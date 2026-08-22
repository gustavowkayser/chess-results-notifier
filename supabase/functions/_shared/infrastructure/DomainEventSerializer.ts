import { DomainEvent } from '../domain/DomainEvent.ts';
import { RoundPublished } from '../domain/events/RoundPublished.ts';
import { TournamentDiscovered } from '../domain/events/TournamentDiscovered.ts';
import { TournamentRegistered } from '../domain/events/TournamentRegistered.ts';
import { TournamentUnregistered } from '../domain/events/TournamentUnregistered.ts';

export interface StoredEvent {
    aggregateId: string;
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
}

type EventFactory = (stored: StoredEvent) => DomainEvent;

const numberOf = (stored: StoredEvent, key: string): number =>
    Number(stored.payload[key] ?? 0);

const factories: Record<string, EventFactory> = {
    [TournamentDiscovered.TYPE]: stored =>
        new TournamentDiscovered(
            stored.aggregateId,
            stored.payload.name as string,
            numberOf(stored, 'currentRound'),
            numberOf(stored, 'totalRounds'),
            new Date(stored.occurredAt),
        ),
    [RoundPublished.TYPE]: stored =>
        new RoundPublished(
            stored.aggregateId,
            numberOf(stored, 'round'),
            numberOf(stored, 'totalRounds'),
            new Date(stored.occurredAt),
        ),
    [TournamentRegistered.TYPE]: stored =>
        new TournamentRegistered(
            stored.aggregateId,
            stored.payload.tournamentUrl as string,
            new Date(stored.occurredAt),
        ),
    [TournamentUnregistered.TYPE]: stored =>
        new TournamentUnregistered(
            stored.aggregateId,
            stored.payload.tournamentUrl as string,
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
