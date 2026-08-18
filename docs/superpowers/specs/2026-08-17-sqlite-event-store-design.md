# SQLite Event Store

Date: 2026-08-17
Status: Approved

## Goal

Replace the AsyncStorage-backed event store with SQLite, and delete the
AsyncStorage adapter along with its dependency.

## Context

`EventRepository` is a three-method port — `save`, `load`, `listAggregateIds` —
with one implementation, `AsyncStorageEventRepository`. That adapter keeps each
aggregate's stream as a JSON array under `crn:stream:<id>`, plus a separate
`crn:streams` key holding the list of known aggregate ids.

The app is bare React Native 0.87 on the new architecture, Hermes enabled,
Android only. The store is read and written from `MonitoringTask`, a headless JS
task, so it must work with no app UI mounted.

At v0.0.1 with the native bridge only just added, this is treated as pre-release
with no installed users. There is no AsyncStorage-to-SQLite data migration: the
new store starts empty.

## Precondition: fix `MonitoringService.checkAll`

Three of the five tests in `__tests__/monitoring.test.ts` fail on `main`, before
any SQLite work. The cause is `MonitoringService.checkAll`:

```ts
let notifications = ids.filter(async id => { ... });
```

`Array.prototype.filter` is synchronous. An `async` callback returns a Promise,
and every Promise is truthy, so `filter` retains every id regardless of what the
callback resolves to. `checkAll()` returns the number of tournaments tracked
rather than the number that notified. The two passing tests pass by coincidence:
they track exactly one tournament and expect `1`.

This is fixed first, in its own commit, so the storage swap can be verified
against a green suite:

```ts
const results = await Promise.all(
    ids.map(id =>
        this.check(id).catch(error => {
            console.warn(`Failed to check tournament ${id}`, error);
            return false;
        }),
    ),
);

return results.filter(Boolean).length;
```

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Driver | `@op-engineering/op-sqlite` | JSI-based, built for the new architecture, actively maintained. `expo-sqlite` would drag the Expo module system into a bare app; `react-native-sqlite-storage` has thin new-arch support. |
| Test strategy | Driver interface with two adapters | `op-sqlite` is native and cannot load under Jest. Node 26 ships `node:sqlite` in the standard library, so the test adapter costs zero dependencies and no `node-gyp` build on Windows. |
| Data migration | None | Pre-release, no installed users. |

### Accepted limitation

`node:sqlite` and the SQLite build inside `op-sqlite` are different binaries and
may differ in version. Tests therefore catch schema and query bugs, not
engine-specific edge cases. For an append-only table with one index, that gap is
acceptable.

## Architecture

```
src/api/infrastructure/
  sqlite/
    SqliteDatabase.ts        (new) driver interface — the seam
    OpSqliteDatabase.ts      (new) op-sqlite adapter, ships in the app
    Mutex.ts                 (new) serializes transactions on a connection
    migrations.ts            (new) schema, versioned by PRAGMA user_version
  SqliteEventRepository.ts   (new) implements EventRepository; owns all SQL
  AsyncStorageEventRepository.ts   (deleted)

test-support/
  NodeSqliteDatabase.ts      (new) node:sqlite adapter, tests only

__mocks__/@op-engineering/
  op-sqlite.js               (new) Jest manual mock for the native module
```

### Transaction serialization

`MonitoringService.checkAll` checks every tournament concurrently, so two
`save` calls can overlap. A SQLite connection has one transaction slot, and a
second `BEGIN` fails with "cannot start a transaction within a transaction".
Both adapters therefore queue transactions through `Mutex`, so callers do not
have to know this.

This hazard predates SQLite: the AsyncStorage adapter had the same race on its
`crn:streams` index key, where two concurrent saves could each read the list and
then overwrite each other. SQLite surfaces it as a loud error instead of silent
loss.

### Jest and the native module

`App.test.tsx` renders the app, which pulls in `src/api/index.ts` and therefore
`op-sqlite`. The package ships untranspiled ESM and has no JavaScript
implementation, so a manual mock in `__mocks__/@op-engineering/op-sqlite.js`
stands in — Jest applies it automatically. Opening is a no-op stub so
module-scope wiring succeeds; running a query throws, pointing at
`NodeSqliteDatabase` instead.

`test-support/` sits outside both `src/` and `__tests__/`. Nothing in the app
imports it, so Metro never traverses it and `node:sqlite` cannot reach the
bundle; and Jest does not mistake it for a test file.

### The seam

```ts
export type SqliteParam = string | number | null;
export type SqliteRow = Record<string, SqliteParam>;

export interface SqliteExecutor {
    execute(sql: string, params?: SqliteParam[]): Promise<SqliteRow[]>;
}

export interface SqliteDatabase extends SqliteExecutor {
    transaction(work: (tx: SqliteExecutor) => Promise<void>): Promise<void>;
}
```

`SqliteEventRepository` depends only on this interface, so the same repository —
same SQL, same schema — runs under Jest and on device.

### Schema

```sql
CREATE TABLE IF NOT EXISTS events (
    sequence     INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregate_id TEXT NOT NULL,
    type         TEXT NOT NULL,
    occurred_at  TEXT NOT NULL,
    payload      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_id, sequence);
```

`sequence` makes append order explicit — it is what the JSON array expressed
implicitly by position.

The `crn:streams` index key disappears. Today `save` performs two writes that
can drift if one fails; in SQL the id list is derived:

```sql
SELECT aggregate_id FROM events GROUP BY aggregate_id ORDER BY MIN(sequence);
```

`MIN(sequence)` preserves registration order, which the existing
`toEqual([SAMPLE_URL])` assertion depends on once more than one tournament is
tracked.

`save` wraps its appends in a transaction, so a multi-event aggregate cannot
half-persist.

### Startup

Schema creation is async, but `src/api/index.ts` wires dependencies at module
scope, synchronously. `SqliteEventRepository` therefore memoizes a `ready`
promise and each public method awaits it: the first call migrates, later calls
await an already-resolved promise. This matters because `MonitoringTask` runs
headless and the JS context can start cold on a tick.

`migrations.ts` keys off `PRAGMA user_version` so later schema changes have
somewhere to go.

`DomainEventSerializer` is unchanged. `StoredEvent.payload` is stringified into
the `payload` column and parsed back on load.

## Testing

`__tests__/monitoring.test.ts` drops the
`jest.mock('@react-native-async-storage/async-storage')` block and builds against
a real in-memory SQLite database via `NodeSqliteDatabase`.

Each `DatabaseSync(':memory:')` is a separate database, so the "no new round"
test — which relies on two `build()` calls sharing one store — passes the
database in explicitly rather than relying on an ambient shared module mock.

All five existing tests must pass unchanged in intent.

One test is added, covering the two queries whose behaviour only becomes
observable with more than one tournament and more than one event per stream:
`ORDER BY sequence` within a stream, and `ORDER BY MIN(sequence)` across
aggregates. It asserts on both streams, since a concurrent write failing on the
second aggregate would otherwise pass unnoticed.

## Cleanup

- Remove `@react-native-async-storage/async-storage` from `package.json`.
- Remove the `transformIgnorePatterns` override in `jest.config.js`, which
  exists only to transpile that package's untranspiled ESM.
- Add `"types": ["jest", "node"]` to `tsconfig.json`; the base
  `@react-native/typescript-config` sets `["jest"]`, which leaves `node:sqlite`
  untyped in `test-support/`.

## Verification

Runnable here: `npx jest` and `npx tsc --noEmit`.

Not runnable here: the Android build. `op-sqlite` is a native module and needs
`npm install` plus a Gradle rebuild on the developer's machine. On-device
behaviour is unverified by this work and will be reported as such.
