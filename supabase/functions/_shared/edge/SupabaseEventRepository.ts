import { SupabaseClient } from '@supabase/supabase-js';
import { AggregateRoot } from '../domain/AggregateRoot.ts';
import { DomainEvent } from '../domain/DomainEvent.ts';
import { EventRepository } from '../application/repositories/EventRepository.ts';
import {
    DomainEventSerializer,
    StoredEvent,
} from '../infrastructure/DomainEventSerializer.ts';

interface EventRow {
    aggregate_id: string;
    type: string;
    occurred_at: string;
    payload: Record<string, unknown>;
}

/**
 * Append-only event store on top of Postgres. Rows are never updated or
 * deleted; an aggregate is rebuilt by replaying its stream in `sequence` order.
 *
 * Expects a service-role client: RLS grants clients no way to write here.
 */
export class SupabaseEventRepository implements EventRepository {
    constructor(private readonly client: SupabaseClient) {}

    async save(aggregate: AggregateRoot): Promise<void> {
        const events = aggregate.pullEvents();

        if (events.length === 0) {
            return;
        }

        const rows = events.map(event => {
            const stored = DomainEventSerializer.serialize(event);

            return {
                aggregate_type: aggregate.aggregateType,
                aggregate_id: stored.aggregateId,
                user_id: aggregate.userId,
                type: stored.type,
                occurred_at: stored.occurredAt,
                payload: stored.payload,
            };
        });

        // One statement, so a multi-event append cannot land half-written — and
        // the projection trigger runs inside the same transaction.
        const { error } = await this.client.from('events').insert(rows);

        if (error) {
            throw new Error(
                `Failed to append ${aggregate.aggregateType} events for ` +
                    `${aggregate.id}: ${error.message}`,
            );
        }
    }

    async load(
        aggregateType: string,
        aggregateId: string,
    ): Promise<DomainEvent[]> {
        const { data, error } = await this.client
            .from('events')
            .select('aggregate_id, type, occurred_at, payload')
            .eq('aggregate_type', aggregateType)
            .eq('aggregate_id', aggregateId)
            .order('sequence');

        if (error) {
            throw new Error(
                `Failed to load ${aggregateType} stream ${aggregateId}: ` +
                    error.message,
            );
        }

        return (data ?? [])
            .map((row: EventRow) => this.toStoredEvent(row))
            .map(stored => DomainEventSerializer.deserialize(stored));
    }

    private toStoredEvent(row: EventRow): StoredEvent {
        return {
            aggregateId: row.aggregate_id,
            type: row.type,
            occurredAt: row.occurred_at,
            payload: row.payload ?? {},
        };
    }
}
