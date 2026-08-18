export type SqliteParam = string | number | null;
export type SqliteRow = Record<string, SqliteParam>;

export interface SqliteExecutor {
    execute(sql: string, params?: SqliteParam[]): Promise<SqliteRow[]>;
}

export interface SqliteDatabase extends SqliteExecutor {
    transaction(work: (tx: SqliteExecutor) => Promise<void>): Promise<void>;
}
