import { DatabaseSync } from 'node:sqlite';
import { Mutex } from '../src/api/infrastructure/sqlite/Mutex.ts';
import {
    SqliteDatabase,
    SqliteExecutor,
    SqliteParam,
    SqliteRow,
} from '../src/api/infrastructure/sqlite/SqliteDatabase.ts';

export class NodeSqliteDatabase implements SqliteDatabase {
    private readonly database: DatabaseSync;
    private readonly mutex = new Mutex();

    constructor(location = ':memory:') {
        this.database = new DatabaseSync(location);
    }

    async execute(
        sql: string,
        params: SqliteParam[] = [],
    ): Promise<SqliteRow[]> {
        // `all` also covers writes and PRAGMAs here, returning an empty array
        // when the statement yields no rows.
        const rows = this.database.prepare(sql).all(...params);

        return rows.map(row => ({ ...row } as SqliteRow));
    }

    async transaction(
        work: (tx: SqliteExecutor) => Promise<void>,
    ): Promise<void> {
        await this.mutex.run(async () => {
            await this.execute('BEGIN');

            try {
                await work(this);
                await this.execute('COMMIT');
            } catch (error) {
                await this.execute('ROLLBACK');

                throw error;
            }
        });
    }

    close(): void {
        this.database.close();
    }
}
