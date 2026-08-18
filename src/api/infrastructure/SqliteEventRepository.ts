import { AggregateRoot } from '../domain/AggregateRoot.ts';
import { DomainEvent } from '../domain/DomainEvent.ts';
import { EventRepository } from '../application/repositories/EventRepository.ts';
import { DomainEventSerializer, StoredEvent } from './DomainEventSerializer.ts';
import { migrate } from './sqlite/migrations.ts';
import { SqliteDatabase } from './sqlite/SqliteDatabase.ts';

const APPEND = `INSERT INTO events (aggregate_id, type, occurred_at, payload)
                VALUES (?, ?, ?, ?)`;

const LOAD_STREAM = `SELECT aggregate_id, type, occurred_at, payload
                     FROM events
                     WHERE aggregate_id = ?
                     ORDER BY sequence`;

// The aggregate list is derived rather than stored, so there is no second
// write to keep in sync. MIN(sequence) preserves registration order.
const LIST_AGGREGATES = `SELECT aggregate_id
                         FROM events
                         GROUP BY aggregate_id
                         ORDER BY MIN(sequence)`;

/**
 * Append-only event store on top of SQLite. Rows are never updated or deleted;
 * an aggregate is rebuilt by replaying its stream in `sequence` order.
 */
export class SqliteEventRepository implements EventRepository {
    private ready?: Promise<void>;

    constructor(private readonly database: SqliteDatabase) {}

    async save(aggregate: AggregateRoot): Promise<void> {
        const events = aggregate.pullEvents();

        if (events.length === 0) {
            return;
        }

        await this.migrated();

        // One transaction per aggregate, so a multi-event append cannot land
        // half-written.
        await this.database.transaction(async tx => {
            for (const event of events) {
                const stored = DomainEventSerializer.serialize(event);

                await tx.execute(APPEND, [
                    stored.aggregateId,
                    stored.type,
                    stored.occurredAt,
                    JSON.stringify(stored.payload),
                ]);
            }
        });
    }

    async load(aggregateId: string): Promise<DomainEvent[]> {
        await this.migrated();

        const rows = await this.database.execute(LOAD_STREAM, [aggregateId]);

        return rows
            .map(row => this.toStoredEvent(row))
            .map(stored => DomainEventSerializer.deserialize(stored));
    }

    async listAggregateIds(): Promise<string[]> {
        await this.migrated();

        const rows = await this.database.execute(LIST_AGGREGATES);

        return rows.map(row => String(row.aggregate_id));
    }

    /**
     * The schema is created on first use and memoized. Dependencies are wired
     * synchronously at module scope, and the monitoring task can start on a
     * cold JS context, so there is no earlier point to await.
     */
    private migrated(): Promise<void> {
        this.ready ??= migrate(this.database);

        return this.ready;
    }

    private toStoredEvent(row: Record<string, unknown>): StoredEvent {
        return {
            aggregateId: String(row.aggregate_id),
            type: String(row.type),
            occurredAt: String(row.occurred_at),
            payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
        };
    }
}
