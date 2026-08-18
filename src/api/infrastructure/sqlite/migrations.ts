import { SqliteDatabase } from './SqliteDatabase.ts';

/**
 * Ordered schema steps. Append to this list to change the schema; never edit or
 * reorder an existing entry, since a device only runs the steps it has not seen.
 */
const MIGRATIONS: string[] = [
    `CREATE TABLE IF NOT EXISTS events (
        sequence     INTEGER PRIMARY KEY AUTOINCREMENT,
        aggregate_id TEXT NOT NULL,
        type         TEXT NOT NULL,
        occurred_at  TEXT NOT NULL,
        payload      TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_events_aggregate
        ON events (aggregate_id, sequence)`,
];

export async function migrate(database: SqliteDatabase): Promise<void> {
    const rows = await database.execute('PRAGMA user_version');
    const version = Number(rows[0]?.user_version ?? 0);

    if (version >= MIGRATIONS.length) {
        return;
    }

    await database.transaction(async tx => {
        for (const statement of MIGRATIONS.slice(version)) {
            await tx.execute(statement);
        }
    });

    // PRAGMA does not accept bound parameters, and the value is an array length
    // rather than anything user-supplied.
    await database.execute(`PRAGMA user_version = ${MIGRATIONS.length}`);
}
