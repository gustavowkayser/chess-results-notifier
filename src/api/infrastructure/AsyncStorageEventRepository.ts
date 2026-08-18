import AsyncStorage from '@react-native-async-storage/async-storage';
import { AggregateRoot } from '../domain/AggregateRoot.ts';
import { DomainEvent } from '../domain/DomainEvent.ts';
import { EventRepository } from '../application/repositories/EventRepository.ts';
import { DomainEventSerializer, StoredEvent } from './DomainEventSerializer.ts';

const INDEX_KEY = 'crn:streams';
const streamKey = (aggregateId: string) => `crn:stream:${aggregateId}`;

/**
 * Append-only event store on top of AsyncStorage. Good enough for the handful
 * of tournaments a user tracks; if replaying ever gets slow, swapping this
 * adapter for a SQLite-backed one is the only change needed.
 */
export class AsyncStorageEventRepository implements EventRepository {
    async save(aggregate: AggregateRoot): Promise<void> {
        const events = aggregate.pullEvents();

        if (events.length === 0) {
            return;
        }

        const key = streamKey(aggregate.id);
        const existing = await this.readStream(key);

        const appended = existing.concat(
            events.map(event => DomainEventSerializer.serialize(event)),
        );

        await AsyncStorage.setItem(key, JSON.stringify(appended));
        await this.indexAggregate(aggregate.id);
    }

    async load(aggregateId: string): Promise<DomainEvent[]> {
        const stored = await this.readStream(streamKey(aggregateId));

        return stored.map(event => DomainEventSerializer.deserialize(event));
    }

    async listAggregateIds(): Promise<string[]> {
        const raw = await AsyncStorage.getItem(INDEX_KEY);

        return raw === null ? [] : (JSON.parse(raw) as string[]);
    }

    private async readStream(key: string): Promise<StoredEvent[]> {
        const raw = await AsyncStorage.getItem(key);

        return raw === null ? [] : (JSON.parse(raw) as StoredEvent[]);
    }

    private async indexAggregate(aggregateId: string): Promise<void> {
        const ids = await this.listAggregateIds();

        if (ids.includes(aggregateId)) {
            return;
        }

        await AsyncStorage.setItem(
            INDEX_KEY,
            JSON.stringify(ids.concat(aggregateId)),
        );
    }
}
