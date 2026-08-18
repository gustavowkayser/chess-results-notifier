import { DB, open } from '@op-engineering/op-sqlite';
import { Mutex } from './Mutex.ts';
import {
    SqliteDatabase,
    SqliteExecutor,
    SqliteParam,
    SqliteRow,
} from './SqliteDatabase.ts';

const DATABASE_NAME = 'chess-results-notifier.sqlite';

export class OpSqliteDatabase implements SqliteDatabase {
    private readonly database: DB;
    private readonly mutex = new Mutex();

    constructor(name: string = DATABASE_NAME) {
        this.database = open({ name });
    }

    async execute(
        sql: string,
        params: SqliteParam[] = [],
    ): Promise<SqliteRow[]> {
        const result = await this.database.execute(sql, params);

        return (result.rows ?? []) as SqliteRow[];
    }

    async transaction(
        work: (tx: SqliteExecutor) => Promise<void>,
    ): Promise<void> {
        await this.mutex.run(async () => {
            await this.database.transaction(async tx => {
                await work({
                    execute: async (sql, params = []) =>
                        ((await tx.execute(sql, params)).rows ??
                            []) as SqliteRow[],
                });
            });
        });
    }

    close(): void {
        this.database.close();
    }
}
